const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Bootstrap first admin API key (no auth required if no keys exist)
router.post('/bootstrap', async (req, res) => {
  try {
    const { db, encryptionService, deviceManager } = req.app.locals;
    
    // Check if any admin API keys exist
    const existingKeys = await db.get('SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1');
    
    if (existingKeys.count > 0) {
      return res.status(400).json({ error: 'Admin API keys already exist. Use the admin interface to create more keys.' });
    }

    // Generate first admin API key
    const apiKey = encryptionService.generateApiKey();
    const keyHash = encryptionService.hashApiKey(apiKey);
    const keyId = uuidv4();

    // Store in database with admin permissions
    await db.run(
      'INSERT INTO api_keys (id, key_hash, device_id, permissions, expires_at) VALUES (?, ?, ?, ?, ?)',
      [keyId, keyHash, deviceManager.deviceId, 'read,write,admin', null]
    );

    res.json({
      success: true,
      apiKey,
      keyId,
      permissions: ['read', 'write', 'admin'],
      message: 'First admin API key created successfully. Save this key securely!'
    });
  } catch (error) {
    console.error('Bootstrap API key error:', error);
    res.status(500).json({ error: 'Failed to create bootstrap API key' });
  }
});


// Validate API key
router.post('/validate', async (req, res) => {
  try {
    const { db, encryptionService } = req.app.locals;
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    const keyHash = encryptionService.hashApiKey(apiKey);
    const keyRecord = await db.get(
      'SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1',
      [keyHash]
    );

    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check expiration
    if (keyRecord.expires_at && new Date() > new Date(keyRecord.expires_at)) {
      return res.status(401).json({ error: 'API key expired' });
    }

    res.json({
      valid: true,
      keyId: keyRecord.id,
      deviceId: keyRecord.device_id,
      permissions: keyRecord.permissions.split(',')
    });
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

// List API keys
router.get('/api-keys', async (req, res) => {
  try {
    const { db } = req.app.locals;
    
    const keys = await db.all(`
      SELECT ak.id, ak.device_id, ak.permissions, ak.created_at, ak.expires_at, ak.is_active,
             d.name as device_name
      FROM api_keys ak
      LEFT JOIN devices d ON ak.device_id = d.id
      WHERE ak.is_active = 1
      ORDER BY ak.created_at DESC
    `);

    res.json({
      apiKeys: keys.map(key => ({
        id: key.id,
        deviceId: key.device_id,
        deviceName: key.device_name,
        permissions: key.permissions.split(','),
        createdAt: key.created_at,
        expiresAt: key.expires_at,
        isActive: key.is_active === 1
      }))
    });
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// Revoke API key
router.delete('/api-keys/:keyId', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { keyId } = req.params;

    await db.run(
      'UPDATE api_keys SET is_active = 0 WHERE id = ?',
      [keyId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('API key revocation error:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// Middleware to authenticate requests
async function authenticateRequest(req, res, next) {
  try {
    const { db, encryptionService } = req.app.locals;
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const keyHash = encryptionService.hashApiKey(apiKey);
    const keyRecord = await db.get(
      'SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1',
      [keyHash]
    );

    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check expiration
    if (keyRecord.expires_at && new Date() > new Date(keyRecord.expires_at)) {
      return res.status(401).json({ error: 'API key expired' });
    }

    // Add key info to request
    req.apiKey = {
      id: keyRecord.id,
      deviceId: keyRecord.device_id,
      permissions: keyRecord.permissions.split(',')
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Check permissions middleware
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.apiKey || !req.apiKey.permissions.includes(permission)) {
      return res.status(403).json({ error: `Permission '${permission}' required` });
    }
    next();
  };
}

// Generate API key (requires authentication)
router.post('/api-key', authenticateRequest, requirePermission('write'), async (req, res) => {
  try {
    const { db, encryptionService, deviceManager } = req.app.locals;
    const { deviceId, permissions = 'read,write', expiresInHours } = req.body;

    // Generate API key
    const apiKey = encryptionService.generateApiKey();
    const keyHash = encryptionService.hashApiKey(apiKey);
    const keyId = uuidv4();

    // Calculate expiration
    let expiresAt = null;
    if (expiresInHours) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    }

    // Store in database
    await db.run(
      'INSERT INTO api_keys (id, key_hash, device_id, permissions, expires_at) VALUES (?, ?, ?, ?, ?)',
      [keyId, keyHash, deviceId || deviceManager.deviceId, permissions, expiresAt]
    );

    res.json({
      success: true,
      apiKey,
      keyId,
      permissions: permissions.split(','),
      expiresAt
    });
  } catch (error) {
    console.error('API key generation error:', error);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

module.exports = router;
module.exports.authenticateRequest = authenticateRequest;
module.exports.requirePermission = requirePermission;