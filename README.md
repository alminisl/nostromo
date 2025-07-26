# 🚀 Nostromo

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![React](https://img.shields.io/badge/react-%5E18.2.0-blue.svg)
![Docker](https://img.shields.io/badge/docker-supported-blue.svg)

**Secure cargo transport for your digital files**

*A self-hosted, end-to-end encrypted file sharing system for local networks*

[Features](#-features) • [Quick Start](#-quick-start) • [API Usage](#-api-usage) • [Security](#-security-model) • [Contributing](#-contributing)

</div>

---

Like the USCSS Nostromo cargo vessel, this system reliably transports your digital cargo across local networks with military-grade security. Perfect for teams, families, or anyone who needs to share files securely within their local network.

## Features

### 🔐 Security
- **End-to-end encryption** using AES-256-GCM and libsodium
- **HTTPS with self-signed certificates** for secure local communication
- **Device fingerprint verification** with trust-on-first-use
- **API key authentication** with configurable permissions
- **Automatic file expiration** to prevent data accumulation

### 📱 Cross-Device Support
- **Device discovery** and identification
- **Device management** with trust levels
- **File tracking** by source device
- **mDNS/Bonjour support** for automatic network discovery (optional)

### 🌐 API Access
- **RESTful API** for programmatic file upload/download
- **cURL/wget compatible** for easy scripting
- **Multiple API keys** with different permissions
- **Bulk operations** and file management

### 💻 Frontend
- **Modern React interface** with Tailwind CSS
- **Drag-and-drop file uploads** with progress tracking
- **Device and file management** dashboards
- **Real-time status updates** and notifications

### 🐳 Deployment
- **Docker support** with docker-compose
- **PostgreSQL or SQLite** database options
- **Environment-based configuration**
- **Portable and self-contained**

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. **Clone and setup:**
   ```bash
   git clone https://github.com/yourusername/nostromo.git
   cd nostromo
   ```

2. **Start the application:**
   ```bash
   # Using Docker (recommended)
   docker-compose up -d
   
   # Or run manually
   npm run install:all
   npm run dev
   ```

3. **Access the application:**
   - Web interface: https://localhost:3000
   - API endpoint: https://localhost:8080/api

> **Note:** On first run, the application will generate self-signed certificates and initial API keys automatically.

### Manual Installation

#### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL (optional, SQLite used by default)

#### Setup

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```

4. **For production:**
   ```bash
   npm run build
   npm start
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FILE_STORAGE_PATH` | Directory for encrypted files | `./uploads` |
| `ENCRYPTION_KEY` | 32-character encryption key | Required |
| `API_KEY` | Initial API key | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `MAX_FILE_AGE` | Auto-expiry time (seconds) | `3600` |
| `PORT` | Server port | `8080` |
| `DB_TYPE` | Database type (`sqlite`/`postgresql`) | `sqlite` |
| `DB_PATH` | SQLite database path | `./data/database.sqlite` |
| `POSTGRES_URL` | PostgreSQL connection string | - |
| `DEVICE_NAME` | Device display name | `hostname-platform` |
| `HTTPS_ENABLED` | Enable HTTPS | `true` |
| `CERT_PATH` | Certificate directory | `./certs` |

### Database Options

#### SQLite (Default)
```bash
DB_TYPE=sqlite
DB_PATH=./data/database.sqlite
```

#### PostgreSQL
```bash
DB_TYPE=postgresql
POSTGRES_URL=postgresql://user:password@localhost:5432/fileshare
```

## 📡 API Usage

### Authentication
All API requests require an API key in the header:
```bash
curl -H "X-API-Key: your-api-key" [endpoint]
```

### Core Endpoints

#### Generate API Key
```bash
curl -X POST http://localhost:8080/api/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "optional-device-id",
    "permissions": "read,write",
    "expiresInHours": 24
  }'
```

#### Upload File
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  -F "file=@example.txt" \
  -F "deviceName=My Laptop" \
  -F "expiresInMinutes=60" \
  http://localhost:8080/api/files
```

#### List Files
```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:8080/api/files
```

#### Download File
```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:8080/api/files/FILE_ID \
  -o downloaded_file
```

#### Delete File
```bash
curl -X DELETE \
  -H "X-API-Key: your-api-key" \
  http://localhost:8080/api/files/FILE_ID
```

### Device Management

#### List Devices
```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:8080/api/devices
```

#### Trust Device
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  http://localhost:8080/api/devices/DEVICE_ID/trust
```

## 🛡️ Security Model

### Encryption
- **File Encryption**: AES-256-GCM with unique keys per file
- **Key Exchange**: libsodium curve25519 for device-to-device communication
- **Storage**: All files encrypted at rest
- **Transport**: HTTPS with self-signed certificates

### Device Trust
- **First Use**: Devices auto-register but require manual trust
- **Fingerprints**: SHA-256 fingerprints for device verification
- **Trust Levels**: Trusted devices can share files, untrusted cannot

### API Security
- **Key-based Authentication**: SHA-256 hashed API keys
- **Permission System**: Read-only or read-write access
- **Expiration**: Optional time-based key expiration
- **Rate Limiting**: Built-in rate limiting per IP

## 🔧 Development

### Project Structure
```
nostromo/
├── server/                 # Node.js backend
│   ├── lib/               # Core libraries
│   │   ├── database.js    # Database abstraction
│   │   ├── encryption.js  # Encryption service
│   │   ├── certificates.js # SSL certificate handling
│   │   └── deviceManager.js # Device management
│   ├── routes/            # API routes
│   │   ├── auth.js        # Authentication
│   │   ├── files.js       # File operations
│   │   └── devices.js     # Device management
│   └── index.js           # Server entry point
├── client/                # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── utils/         # Utilities and API client
│   │   └── App.jsx        # Main application
│   └── public/
├── docker-compose.yml     # Docker orchestration
├── Dockerfile            # Container definition
└── README.md
```

### Adding Features

#### New API Endpoint
1. Add route in `server/routes/`
2. Update API client in `client/src/utils/api.js`
3. Add corresponding React component if needed

#### New Encryption Method
1. Extend `EncryptionService` in `server/lib/encryption.js`
2. Update file upload/download logic
3. Ensure backward compatibility

### Testing

#### Manual Testing
```bash
# Start development environment
npm run dev

# Test file upload
curl -X POST -H "X-API-Key: test-key" -F "file=@test.txt" http://localhost:8080/api/files

# Test file download
curl -H "X-API-Key: test-key" http://localhost:8080/api/files/FILE_ID -o downloaded.txt
```

## Deployment

### Production Checklist
- [ ] Generate secure encryption keys
- [ ] Configure HTTPS certificates
- [ ] Set up persistent storage volumes
- [ ] Configure database backups
- [ ] Review security settings
- [ ] Test cross-device functionality

### Docker Production
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "443:8080"  # HTTPS only
    environment:
      - NODE_ENV=production
      - HTTPS_ENABLED=true
    volumes:
      - ./uploads:/app/uploads
      - ./certs:/app/certs
      - ./data:/app/data
```

### Reverse Proxy (Optional)
```nginx
# nginx.conf
server {
    listen 443 ssl;
    server_name your-domain.local;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Troubleshooting

### Common Issues

#### Certificate Errors
Self-signed certificates will show browser warnings. This is expected for local networks.
```bash
# Regenerate certificates
rm -rf certs/
# Restart application to auto-generate new certificates
```

#### Database Connection Issues
```bash
# SQLite permissions
chmod 644 data/database.sqlite

# PostgreSQL connection
psql -h localhost -p 5432 -U fileshare -d fileshare
```

#### File Upload Failures
- Check disk space in upload directory
- Verify file size limits (default 500MB)
- Ensure encryption key is properly set

#### Device Discovery Not Working
- Check network connectivity
- Verify mDNS/Bonjour support
- Manual device registration available as fallback

### Logs
```bash
# Docker logs
docker-compose logs -f app

# Development logs
npm run dev  # Shows server and client logs
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Setup
```bash
git clone https://github.com/yourusername/nostromo.git
cd nostromo
npm run install:all
npm run dev
```

### Security Issues
Report security vulnerabilities privately to the maintainers.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with **Node.js**, **React**, and modern web technologies
- Encryption powered by **libsodium** and **Node.js crypto**
- UI components from **Heroicons** and **Tailwind CSS**
- Icons and badges from **Shields.io**

---

<div align="center">
Made with ❤️ for secure cargo transport
</div>