# 📱 Mobile Device Access Guide

## Quick Setup for Cross-Device File Sharing

### 1. **Start the Server**
```bash
./start-demo.js
```

### 2. **Find Your Network Access URLs**
The demo script will show you all available URLs:
```
📋 Access Information:
   • Web Interface: https://localhost:8080
   • Web Interface: https://192.168.1.205:8080  ← Use this for mobile devices
     (Access from other devices on your network)
```

### 3. **Access from Mobile Device**

#### On Your Phone/Tablet:
1. **Connect to the same WiFi network** as your laptop
2. Open your mobile browser
3. Navigate to: `https://192.168.1.205:8080` (use your actual IP)
4. **Accept the certificate warning:**
   - **Chrome/Safari**: Tap "Advanced" → "Proceed to 192.168.1.205 (unsafe)"
   - **Firefox**: Tap "Advanced" → "Accept the Risk and Continue"

#### Why the Certificate Warning?
- The app uses self-signed certificates for security
- This is normal for local network applications
- Your data is still encrypted and secure

### 4. **Login on Mobile**
- Enter API Key: `demo-api-key-for-testing-12345678`
- Tap "Connect"

### 5. **Share Files Between Devices**
- **Upload from mobile**: Drag & drop or tap to select files
- **Download to mobile**: Tap the download button on any file
- **View all devices**: Check the "Devices" tab to see connected devices

## 🔧 API Access from Mobile

You can also use the API directly from mobile apps or scripts:

### Upload File from Mobile
```bash
# Using a mobile terminal app or from another computer
curl -k -X POST \
  -H "X-API-Key: demo-api-key-for-testing-12345678" \
  -F "file=@photo.jpg" \
  https://192.168.1.205:8080/api/files
```

### List Files
```bash
curl -k -H "X-API-Key: demo-api-key-for-testing-12345678" \
  https://192.168.1.205:8080/api/files
```

## 🔒 Security Features

### Device Trust
- New devices appear as "Untrusted" initially
- Go to "Devices" tab to trust new devices
- Only trusted devices can share files

### File Encryption
- All files are encrypted before storage
- Each file has a unique encryption key
- Files are automatically cleaned up after expiration

### Network Security
- Uses HTTPS with certificate fingerprint verification
- No external internet connection required
- All traffic stays within your local network

## 🛠️ Troubleshooting

### Mobile Browser Issues
- **"Site can't be reached"**: Check if both devices are on same WiFi network
- **Certificate errors**: Make sure to accept the security warning
- **Loading issues**: Clear browser cache and try again

### API Access Issues
- **Connection refused**: Ensure server is running and accessible
- **Authentication errors**: Double-check the API key
- **File upload fails**: Check file size (max 500MB) and network connection

### Network Discovery
- **Device not showing**: Devices appear after first file share or manual trust
- **IP address changed**: Restart the server to detect new IP address
- **Firewall blocking**: Check if port 8080 is blocked by firewall

## 📚 Advanced Usage

### Custom Device Names
When uploading files, you can specify a custom device name:
```bash
curl -k -X POST \
  -H "X-API-Key: demo-api-key-for-testing-12345678" \
  -F "file=@document.pdf" \
  -F "deviceName=iPhone 13" \
  https://192.168.1.205:8080/api/files
```

### File Expiration
Set custom expiration times:
```bash
curl -k -X POST \
  -H "X-API-Key: demo-api-key-for-testing-12345678" \
  -F "file=@temp-file.txt" \
  -F "expiresInMinutes=30" \
  https://192.168.1.205:8080/api/files
```

### Generate New API Keys
Use the web interface "API Keys" tab to:
- Generate device-specific API keys
- Set different permissions (read-only, read-write)
- Create temporary keys with expiration times

---

**🎉 You're now ready to share files securely across all your devices!**

The system works entirely within your local network - no cloud servers, no external dependencies, just secure peer-to-peer file sharing.