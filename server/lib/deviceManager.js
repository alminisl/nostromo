const { v4: uuidv4 } = require('uuid');
const os = require('os');
const fs = require('fs');
const path = require('path');

class DeviceManager {
  constructor(db) {
    this.db = db;
    this.deviceId = null;
    this.deviceName = null;
    this.publicKey = null;
    this.secretKey = null;
    this.mdnsService = null;
  }

  async initialize() {
    await this.loadOrCreateDeviceIdentity();
    await this.registerDevice();
    // await this.startMDNSDiscovery(); // Optional mDNS for device discovery
  }

  async loadOrCreateDeviceIdentity() {
    const identityPath = path.join('./data', 'device-identity.json');
    
    if (fs.existsSync(identityPath)) {
      try {
        const identity = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
        this.deviceId = identity.deviceId;
        this.deviceName = identity.deviceName;
        this.publicKey = identity.publicKey;
        this.secretKey = identity.secretKey;
        console.log(`Loaded device identity: ${this.deviceName} (${this.deviceId})`);
        return;
      } catch (error) {
        console.warn('Failed to load device identity, creating new one:', error.message);
      }
    }

    // Create new device identity
    const { EncryptionService } = require('./encryption');
    const encryptionService = new EncryptionService();
    
    this.deviceId = uuidv4();
    this.deviceName = process.env.DEVICE_NAME || `${os.hostname()}-${os.platform()}`;
    
    const keyPair = encryptionService.generateKeyPair();
    this.publicKey = keyPair.publicKey;
    this.secretKey = keyPair.secretKey;

    const identity = {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      publicKey: this.publicKey,
      secretKey: this.secretKey,
      created: new Date().toISOString()
    };

    // Save identity
    fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2));
    console.log(`Created new device identity: ${this.deviceName} (${this.deviceId})`);
  }

  async registerDevice() {
    const ip = this.getLocalIP();
    const { EncryptionService } = require('./encryption');
    const encryptionService = new EncryptionService();
    const fingerprint = encryptionService.generateFingerprint(this.publicKey);

    // Check if device exists
    const existing = await this.db.get(
      'SELECT * FROM devices WHERE id = ?',
      [this.deviceId]
    );

    if (existing) {
      // Update existing device
      await this.db.run(
        'UPDATE devices SET name = ?, ip_address = ?, fingerprint = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
        [this.deviceName, ip, fingerprint, this.deviceId]
      );
    } else {
      // Insert new device
      await this.db.run(
        'INSERT INTO devices (id, name, ip_address, fingerprint, is_trusted) VALUES (?, ?, ?, ?, 1)',
        [this.deviceId, this.deviceName, ip, fingerprint]
      );
    }

    console.log(`Device registered: ${this.deviceName} at ${ip}`);
  }

  async addDiscoveredDevice(deviceInfo) {
    const { deviceId, deviceName, ipAddress, publicKey } = deviceInfo;
    
    if (deviceId === this.deviceId) {
      return; // Don't add ourselves
    }

    const { EncryptionService } = require('./encryption');
    const encryptionService = new EncryptionService();
    const fingerprint = encryptionService.generateFingerprint(publicKey);

    const existing = await this.db.get(
      'SELECT * FROM devices WHERE id = ?',
      [deviceId]
    );

    if (existing) {
      await this.db.run(
        'UPDATE devices SET name = ?, ip_address = ?, fingerprint = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
        [deviceName, ipAddress, fingerprint, deviceId]
      );
    } else {
      await this.db.run(
        'INSERT INTO devices (id, name, ip_address, fingerprint, is_trusted) VALUES (?, ?, ?, ?, 0)',
        [deviceId, deviceName, ipAddress, fingerprint]
      );
    }

    console.log(`Discovered device: ${deviceName} at ${ipAddress}`);
  }

  async getDevices() {
    return await this.db.all(
      'SELECT id, name, ip_address, fingerprint, last_seen, is_trusted, created_at FROM devices ORDER BY last_seen DESC'
    );
  }

  async getDevice(deviceId) {
    return await this.db.get(
      'SELECT * FROM devices WHERE id = ?',
      [deviceId]
    );
  }

  async trustDevice(deviceId) {
    await this.db.run(
      'UPDATE devices SET is_trusted = 1 WHERE id = ?',
      [deviceId]
    );
  }

  async untrustDevice(deviceId) {
    await this.db.run(
      'UPDATE devices SET is_trusted = 0 WHERE id = ?',
      [deviceId]
    );
  }

  async deleteDevice(deviceId) {
    if (deviceId === this.deviceId) {
      throw new Error('Cannot delete own device');
    }
    
    await this.db.run('DELETE FROM devices WHERE id = ?', [deviceId]);
  }

  getLocalIP() {
    const interfaces = os.networkInterfaces();
    
    // Prefer non-internal IPv4 addresses
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    
    return '127.0.0.1';
  }

  getDeviceInfo() {
    return {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      publicKey: this.publicKey,
      ipAddress: this.getLocalIP()
    };
  }

  // Optional: mDNS service discovery
  async startMDNSDiscovery() {
    try {
      let mdns;
      try {
        mdns = require('mdns');
      } catch (mdnsError) {
        console.warn('mDNS not available - install mdns package for automatic device discovery');
        return;
      }
      
      // Advertise our service
      const ad = mdns.createAdvertisement(mdns.tcp('secure-file-share'), 8080, {
        name: this.deviceName,
        txtRecord: {
          deviceId: this.deviceId,
          publicKey: this.publicKey
        }
      });
      
      ad.start();
      console.log('mDNS advertisement started');

      // Browse for other devices
      const browser = mdns.createBrowser(mdns.tcp('secure-file-share'));
      
      browser.on('serviceUp', async (service) => {
        if (service.txtRecord && service.txtRecord.deviceId !== this.deviceId) {
          await this.addDiscoveredDevice({
            deviceId: service.txtRecord.deviceId,
            deviceName: service.name,
            ipAddress: service.addresses[0],
            publicKey: service.txtRecord.publicKey
          });
        }
      });

      browser.start();
      console.log('mDNS browser started');
      
      this.mdnsService = { ad, browser };
    } catch (error) {
      console.warn('mDNS not available:', error.message);
    }
  }

  async cleanup() {
    if (this.mdnsService) {
      this.mdnsService.ad.stop();
      this.mdnsService.browser.stop();
    }
  }
}

module.exports = { DeviceManager };