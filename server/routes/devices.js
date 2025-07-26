const express = require('express');
const { authenticateRequest, requirePermission } = require('./auth');

const router = express.Router();

// List all devices
router.get('/', authenticateRequest, requirePermission('read'), async (req, res) => {
  try {
    const { deviceManager } = req.app.locals;
    const devices = await deviceManager.getDevices();
    
    res.json({
      devices: devices.map(device => ({
        id: device.id,
        name: device.name,
        ipAddress: device.ip_address,
        fingerprint: device.fingerprint,
        lastSeen: device.last_seen,
        isTrusted: device.is_trusted === 1,
        createdAt: device.created_at,
        isSelf: device.id === deviceManager.deviceId
      }))
    });
  } catch (error) {
    console.error('List devices error:', error);
    res.status(500).json({ error: 'Failed to list devices' });
  }
});

// Get current device info
router.get('/me', authenticateRequest, requirePermission('read'), async (req, res) => {
  try {
    const { deviceManager } = req.app.locals;
    const deviceInfo = deviceManager.getDeviceInfo();
    
    res.json({
      device: {
        id: deviceInfo.deviceId,
        name: deviceInfo.deviceName,
        ipAddress: deviceInfo.ipAddress,
        publicKey: deviceInfo.publicKey
      }
    });
  } catch (error) {
    console.error('Get device info error:', error);
    res.status(500).json({ error: 'Failed to get device info' });
  }
});

// Get device by ID
router.get('/:deviceId', authenticateRequest, requirePermission('read'), async (req, res) => {
  try {
    const { deviceManager } = req.app.locals;
    const { deviceId } = req.params;
    
    const device = await deviceManager.getDevice(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json({
      device: {
        id: device.id,
        name: device.name,
        ipAddress: device.ip_address,
        fingerprint: device.fingerprint,
        lastSeen: device.last_seen,
        isTrusted: device.is_trusted === 1,
        createdAt: device.created_at,
        isSelf: device.id === deviceManager.deviceId
      }
    });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ error: 'Failed to get device' });
  }
});

// Update device name
router.put('/:deviceId', authenticateRequest, requirePermission('write'), async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { deviceId } = req.params;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Valid device name required' });
    }
    
    const result = await db.run(
      'UPDATE devices SET name = ? WHERE id = ?',
      [name.trim(), deviceId]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// Trust device
router.post('/:deviceId/trust', authenticateRequest, requirePermission('write'), async (req, res) => {
  try {
    const { deviceManager } = req.app.locals;
    const { deviceId } = req.params;
    
    await deviceManager.trustDevice(deviceId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Trust device error:', error);
    res.status(500).json({ error: 'Failed to trust device' });
  }
});

// Untrust device
router.post('/:deviceId/untrust', authenticateRequest, requirePermission('write'), async (req, res) => {
  try {
    const { deviceManager } = req.app.locals;
    const { deviceId } = req.params;
    
    await deviceManager.untrustDevice(deviceId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Untrust device error:', error);
    res.status(500).json({ error: 'Failed to untrust device' });
  }
});

// Delete device
router.delete('/:deviceId', authenticateRequest, requirePermission('write'), async (req, res) => {
  try {
    const { deviceManager } = req.app.locals;
    const { deviceId } = req.params;
    
    if (deviceId === deviceManager.deviceId) {
      return res.status(400).json({ error: 'Cannot delete own device' });
    }
    
    await deviceManager.deleteDevice(deviceId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// Get device statistics
router.get('/:deviceId/stats', authenticateRequest, requirePermission('read'), async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { deviceId } = req.params;
    
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_files,
        SUM(size) as total_size,
        SUM(download_count) as total_downloads,
        MAX(upload_time) as last_upload
      FROM files 
      WHERE device_id = ? AND is_deleted = 0
    `, [deviceId]);
    
    const activeFiles = await db.get(`
      SELECT COUNT(*) as count
      FROM files 
      WHERE device_id = ? AND is_deleted = 0 
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `, [deviceId]);
    
    res.json({
      deviceId,
      stats: {
        totalFiles: stats.total_files || 0,
        totalSize: stats.total_size || 0,
        totalDownloads: stats.total_downloads || 0,
        lastUpload: stats.last_upload,
        activeFiles: activeFiles.count || 0
      }
    });
  } catch (error) {
    console.error('Device stats error:', error);
    res.status(500).json({ error: 'Failed to get device statistics' });
  }
});

// Register new device (for external devices)
router.post('/register', async (req, res) => {
  try {
    const { deviceManager } = req.app.locals;
    const { deviceName, publicKey, ipAddress } = req.body;
    
    if (!deviceName || !publicKey) {
      return res.status(400).json({ error: 'Device name and public key required' });
    }
    
    const deviceInfo = {
      deviceId: require('uuid').v4(),
      deviceName,
      publicKey,
      ipAddress: ipAddress || req.ip
    };
    
    await deviceManager.addDiscoveredDevice(deviceInfo);
    
    res.json({
      success: true,
      deviceId: deviceInfo.deviceId,
      message: 'Device registered. Trust must be established manually.'
    });
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Network discovery endpoint
router.get('/discover', async (req, res) => {
  try {
    const { deviceManager } = req.app.locals;
    const deviceInfo = deviceManager.getDeviceInfo();
    
    res.json({
      device: {
        id: deviceInfo.deviceId,
        name: deviceInfo.deviceName,
        publicKey: deviceInfo.publicKey,
        ipAddress: deviceInfo.ipAddress,
        services: ['secure-file-share'],
        version: '1.0.0'
      }
    });
  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({ error: 'Discovery failed' });
  }
});

module.exports = router;