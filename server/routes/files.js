const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticateRequest, requirePermission } = require('./auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = process.env.FILE_STORAGE_PATH || './uploads';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Optional: Add file type restrictions here
    cb(null, true);
  }
});

// List files (public access for sharing)
router.get('/', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { deviceId, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT f.id, f.filename, f.original_name, f.size, f.mime_type, 
             f.device_id, f.upload_time, f.expires_at, f.download_count,
             d.name as device_name, d.ip_address as device_ip
      FROM files f
      LEFT JOIN devices d ON f.device_id = d.id
      WHERE f.is_deleted = 0
    `;
    
    const params = [];
    
    if (deviceId) {
      query += ' AND f.device_id = ?';
      params.push(deviceId);
    }
    
    // Only show non-expired files
    query += ' AND (f.expires_at IS NULL OR f.expires_at > datetime("now"))';
    query += ' ORDER BY f.upload_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const files = await db.all(query, params);
    
    res.json({
      files: files.map(file => ({
        id: file.id,
        filename: file.original_name,
        size: file.size,
        mimeType: file.mime_type,
        deviceId: file.device_id,
        deviceName: file.device_name,
        deviceIp: file.device_ip,
        uploadTime: file.upload_time,
        expiresAt: file.expires_at,
        downloadCount: file.download_count
      }))
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Upload file (public access for easy sharing)
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { db, encryptionService, deviceManager } = req.app.locals;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileId = uuidv4();
    const { deviceId, deviceName, expiresInMinutes } = req.body;
    
    // Use provided device ID or create/find anonymous device
    let sourceDeviceId = deviceId;
    
    if (!sourceDeviceId) {
      // Create or find anonymous device based on IP and user agent
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const anonymousDeviceName = deviceName || `Anonymous Device (${clientIP})`;
      
      // Look for existing anonymous device or create new one
      const existingDevice = await db.get(
        'SELECT * FROM devices WHERE name = ? AND ip_address = ?',
        [anonymousDeviceName, clientIP]
      );
      
      if (existingDevice) {
        sourceDeviceId = existingDevice.id;
      } else {
        const { v4: uuidv4 } = require('uuid');
        sourceDeviceId = uuidv4();
        
        await db.run(
          'INSERT INTO devices (id, name, ip_address, is_trusted) VALUES (?, ?, ?, 1)',
          [sourceDeviceId, anonymousDeviceName, clientIP]
        );
      }
    }
    
    // Generate encryption key for this file
    const encryptionKey = encryptionService.generateKey();
    
    // Read and encrypt the file
    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const encryptedBuffer = encryptionService.encryptFile(fileBuffer, encryptionKey);
    
    // Save encrypted file
    const encryptedFilePath = `${filePath}.enc`;
    fs.writeFileSync(encryptedFilePath, encryptedBuffer);
    
    // Remove original unencrypted file
    fs.unlinkSync(filePath);
    
    // Calculate expiration
    let expiresAt = null;
    if (expiresInMinutes) {
      expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(expiresInMinutes));
      expiresAt = expiresAt.toISOString(); // Store as ISO string
    } else if (process.env.MAX_FILE_AGE) {
      expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + parseInt(process.env.MAX_FILE_AGE));
      expiresAt = expiresAt.toISOString(); // Store as ISO string
    }
    
    // Store file metadata in database
    await db.run(`
      INSERT INTO files (id, filename, original_name, size, mime_type, device_id, encryption_key, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      fileId,
      path.basename(encryptedFilePath),
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
      sourceDeviceId,
      encryptionKey,
      expiresAt
    ]);
    
    // Update device name if provided and different from current
    if (deviceName) {
      const currentDevice = await db.get('SELECT name FROM devices WHERE id = ?', [sourceDeviceId]);
      if (currentDevice && currentDevice.name !== deviceName) {
        await db.run(
          'UPDATE devices SET name = ? WHERE id = ?',
          [deviceName, sourceDeviceId]
        );
      }
    }
    
    res.json({
      success: true,
      fileId,
      filename: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      deviceId: sourceDeviceId,
      expiresAt,
      uploadTime: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('File upload error:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        fs.unlinkSync(`${req.file.path}.enc`);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
    
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Download file (public access with share links)
router.get('/:fileId', async (req, res) => {
  try {
    const { db, encryptionService } = req.app.locals;
    const { fileId } = req.params;
    
    // Get file metadata
    const file = await db.get(`
      SELECT f.*, d.name as device_name
      FROM files f
      LEFT JOIN devices d ON f.device_id = d.id
      WHERE f.id = ? AND f.is_deleted = 0
    `, [fileId]);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check expiration
    if (file.expires_at && new Date() > new Date(file.expires_at)) {
      return res.status(410).json({ error: 'File expired' });
    }
    
    // Get file path
    const uploadsDir = process.env.FILE_STORAGE_PATH || './uploads';
    const filePath = path.join(uploadsDir, file.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    try {
      // Read and decrypt file
      const encryptedBuffer = fs.readFileSync(filePath);
      const decryptedBuffer = encryptionService.decryptFile(encryptedBuffer, file.encryption_key);
      
      // Update download count
      await db.run(
        'UPDATE files SET download_count = download_count + 1 WHERE id = ?',
        [fileId]
      );
      
      // Set response headers
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
      res.setHeader('Content-Length', decryptedBuffer.length);
      res.setHeader('X-File-Device', file.device_name || 'Unknown Device');
      res.setHeader('X-File-Upload-Time', file.upload_time);
      
      res.send(decryptedBuffer);
      
    } catch (decryptionError) {
      console.error('File decryption error:', decryptionError);
      res.status(500).json({ error: 'File decryption failed' });
    }
    
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'File download failed' });
  }
});

// Get file info (public access)
router.get('/:fileId/info', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { fileId } = req.params;
    
    const file = await db.get(`
      SELECT f.id, f.original_name, f.size, f.mime_type, f.device_id, f.upload_time, 
             f.expires_at, f.download_count, d.name as device_name, d.ip_address as device_ip
      FROM files f
      LEFT JOIN devices d ON f.device_id = d.id
      WHERE f.id = ? AND f.is_deleted = 0
    `, [fileId]);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check expiration
    if (file.expires_at && new Date() > new Date(file.expires_at)) {
      return res.status(410).json({ error: 'File expired' });
    }
    
    res.json({
      id: file.id,
      filename: file.original_name,
      size: file.size,
      mimeType: file.mime_type,
      deviceId: file.device_id,
      deviceName: file.device_name,
      deviceIp: file.device_ip,
      uploadTime: file.upload_time,
      expiresAt: file.expires_at,
      downloadCount: file.download_count
    });
    
  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

// Delete file (admin only)
router.delete('/:fileId', authenticateRequest, requirePermission('write'), async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { fileId } = req.params;
    
    // Get file info
    const file = await db.get(
      'SELECT * FROM files WHERE id = ? AND is_deleted = 0',
      [fileId]
    );
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Mark as deleted in database
    await db.run(
      'UPDATE files SET is_deleted = 1 WHERE id = ?',
      [fileId]
    );
    
    // Optional: Actually delete the file from disk
    const uploadsDir = process.env.FILE_STORAGE_PATH || './uploads';
    const filePath = path.join(uploadsDir, file.filename);
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fsError) {
      console.warn('Failed to delete file from disk:', fsError.message);
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({ error: 'File deletion failed' });
  }
});

// Cleanup expired files (admin only)
router.post('/cleanup', authenticateRequest, requirePermission('write'), async (req, res) => {
  try {
    const { db } = req.app.locals;
    const uploadsDir = process.env.FILE_STORAGE_PATH || './uploads';
    
    // Find expired files
    const expiredFiles = await db.all(`
      SELECT * FROM files 
      WHERE expires_at IS NOT NULL 
      AND expires_at < CURRENT_TIMESTAMP 
      AND is_deleted = 0
    `);
    
    let cleanedCount = 0;
    
    for (const file of expiredFiles) {
      // Mark as deleted
      await db.run('UPDATE files SET is_deleted = 1 WHERE id = ?', [file.id]);
      
      // Delete from disk
      const filePath = path.join(uploadsDir, file.filename);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        cleanedCount++;
      } catch (fsError) {
        console.warn(`Failed to delete expired file ${file.filename}:`, fsError.message);
      }
    }
    
    res.json({ 
      success: true, 
      cleanedFiles: cleanedCount,
      expiredFiles: expiredFiles.length
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

module.exports = router;