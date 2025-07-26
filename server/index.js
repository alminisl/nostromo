require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const { setupDatabase } = require('./lib/database');
const { initializeCertificates } = require('./lib/certificates');
const { DeviceManager } = require('./lib/deviceManager');
const { EncryptionService } = require('./lib/encryption');

const filesRoutes = require('./routes/files');
const devicesRoutes = require('./routes/devices');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 8080;
const CLIENT_PORT = 3000;

// Trust proxy for rate limiting and forwarded headers
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow cross-origin requests
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration for local network access
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow specific external origins
    const allowedExternalOrigins = [
      'https://wormhole.supersecretserver.xyz'
    ];
    
    // Allow localhost and local network IPs
    const allowedPatterns = [
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
      /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
      /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+(:\d+)?$/
    ];
    
    // Check if origin is explicitly allowed or matches local network patterns
    const isExternallyAllowed = allowedExternalOrigins.includes(origin);
    const isLocallyAllowed = allowedPatterns.some(pattern => pattern.test(origin));
    
    if (isExternallyAllowed || isLocallyAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Accept', 'Origin', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  trustProxy: true, // Trust proxy headers
  keyGenerator: (req) => {
    // Use the real IP address, accounting for proxies
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create necessary directories
const uploadsDir = process.env.FILE_STORAGE_PATH || './uploads';
const dataDir = './data';
const certsDir = process.env.CERT_PATH || './certs';

[uploadsDir, dataDir, certsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize services
let db, deviceManager, encryptionService;

async function initializeServer() {
  try {
    // Initialize database
    db = await setupDatabase();
    console.log('Database initialized');

    // Initialize device manager
    deviceManager = new DeviceManager(db);
    await deviceManager.initialize();
    console.log('Device manager initialized');

    // Initialize encryption service
    encryptionService = new EncryptionService();
    console.log('Encryption service initialized');

    // Create initial API key if configured
    if (process.env.API_KEY) {
      const keyHash = encryptionService.hashApiKey(process.env.API_KEY);
      const existingKey = await db.get('SELECT * FROM api_keys WHERE key_hash = ?', [keyHash]);
      
      if (!existingKey) {
        const { v4: uuidv4 } = require('uuid');
        await db.run(
          'INSERT INTO api_keys (id, key_hash, device_id, permissions) VALUES (?, ?, ?, ?)',
          [uuidv4(), keyHash, deviceManager.deviceId, 'read,write']
        );
        console.log('Initial API key registered');
      }
    }

    // Make services available to routes
    app.locals.db = db;
    app.locals.deviceManager = deviceManager;
    app.locals.encryptionService = encryptionService;

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/files', filesRoutes);
    app.use('/api/devices', devicesRoutes);

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Serve static files from client build
    app.use(express.static(path.join(__dirname, '../client/build')));
    
    // Catch all handler for client-side routing
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      res.sendFile(path.join(__dirname, '../client/build/index.html'));
    });

    // Start server
    if (process.env.HTTPS_ENABLED === 'true') {
      const { cert, key } = await initializeCertificates(certsDir);
      const httpsServer = https.createServer({ cert, key }, app);
      
      // Listen on all network interfaces (0.0.0.0) to accept connections from any device
      httpsServer.listen(PORT, '0.0.0.0', () => {
        const localIP = deviceManager.getLocalIP();
        console.log(`HTTPS Server running on port ${PORT}`);
        console.log(`Local access: https://localhost:${PORT}`);
        console.log(`Network access: https://${localIP}:${PORT}`);
        console.log(`Access from any device on your network using: https://${localIP}:${PORT}`);
      });

      // Also start HTTP server for client development and redirects
      const httpApp = express();
      httpApp.use(cors({
        origin: '*', // Allow all origins for HTTP redirects
        credentials: false
      }));
      httpApp.get('*', (req, res) => {
        const localIP = deviceManager.getLocalIP();
        const targetUrl = `https://${req.get('host').includes('localhost') ? 'localhost' : localIP}:${PORT}${req.path}`;
        res.redirect(targetUrl);
      });
      
      http.createServer(httpApp).listen(CLIENT_PORT, '0.0.0.0', () => {
        const localIP = deviceManager.getLocalIP();
        console.log(`HTTP redirect server running on port ${CLIENT_PORT}`);
        console.log(`HTTP redirects: http://${localIP}:${CLIENT_PORT} → https://${localIP}:${PORT}`);
      });
    } else {
      // Listen on all network interfaces for HTTP
      app.listen(PORT, '0.0.0.0', () => {
        const localIP = deviceManager.getLocalIP();
        console.log(`HTTP Server running on port ${PORT}`);
        console.log(`Local access: http://localhost:${PORT}`);
        console.log(`Network access: http://${localIP}:${PORT}`);
        console.log(`Access from any device on your network using: http://${localIP}:${PORT}`);
      });
    }

  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (db) {
    await db.close();
  }
  if (deviceManager) {
    await deviceManager.cleanup();
  }
  process.exit(0);
});

initializeServer();