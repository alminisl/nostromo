const crypto = require('crypto');
const sodium = require('sodium-native');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.tagLength = 16; // 128 bits
  }

  generateKey() {
    // Generate key for AES-256-GCM (32 bytes)
    return crypto.randomBytes(this.keyLength).toString('base64');
  }

  generateKeyPair() {
    const publicKey = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES);
    const secretKey = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES);
    
    sodium.crypto_box_keypair(publicKey, secretKey);
    
    return {
      publicKey: publicKey.toString('base64'),
      secretKey: secretKey.toString('base64')
    };
  }

  encryptFile(buffer, keyBase64) {
    try {
      // Use crypto for file encryption (faster for large files)
      const key = Buffer.from(keyBase64, 'base64');
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipher(this.algorithm, key, iv);
      const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
      const tag = cipher.getAuthTag();
      
      // Return IV + tag + encrypted data
      return Buffer.concat([iv, tag, encrypted]);
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  decryptFile(encryptedBuffer, keyBase64) {
    try {
      const key = Buffer.from(keyBase64, 'base64');
      
      // Extract IV, tag, and encrypted data
      const iv = encryptedBuffer.slice(0, this.ivLength);
      const tag = encryptedBuffer.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = encryptedBuffer.slice(this.ivLength + this.tagLength);
      
      const decipher = crypto.createDecipher(this.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  // For small data like metadata
  encryptData(data, keyBase64) {
    try {
      const key = Buffer.from(keyBase64, 'base64');
      const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
      sodium.randombytes_buf(nonce);
      
      const message = Buffer.from(JSON.stringify(data), 'utf8');
      const ciphertext = Buffer.alloc(message.length + sodium.crypto_secretbox_MACBYTES);
      
      sodium.crypto_secretbox_easy(ciphertext, message, nonce, key);
      
      return {
        nonce: nonce.toString('base64'),
        ciphertext: ciphertext.toString('base64')
      };
    } catch (error) {
      throw new Error(`Data encryption failed: ${error.message}`);
    }
  }

  decryptData(encryptedData, keyBase64) {
    try {
      const key = Buffer.from(keyBase64, 'base64');
      const nonce = Buffer.from(encryptedData.nonce, 'base64');
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
      
      const message = Buffer.alloc(ciphertext.length - sodium.crypto_secretbox_MACBYTES);
      
      if (!sodium.crypto_secretbox_open_easy(message, ciphertext, nonce, key)) {
        throw new Error('Decryption verification failed');
      }
      
      return JSON.parse(message.toString('utf8'));
    } catch (error) {
      throw new Error(`Data decryption failed: ${error.message}`);
    }
  }

  // Generate fingerprint for device verification
  generateFingerprint(publicKey) {
    const hash = crypto.createHash('sha256');
    hash.update(publicKey);
    return hash.digest('hex').slice(0, 16); // First 16 chars for display
  }

  // Hash API keys
  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  // Generate secure API key
  generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Encrypt key exchange for device-to-device communication
  encryptForDevice(data, recipientPublicKey, senderSecretKey) {
    try {
      const message = Buffer.from(JSON.stringify(data), 'utf8');
      const nonce = Buffer.alloc(sodium.crypto_box_NONCEBYTES);
      sodium.randombytes_buf(nonce);
      
      const ciphertext = Buffer.alloc(message.length + sodium.crypto_box_MACBYTES);
      const recipientPk = Buffer.from(recipientPublicKey, 'base64');
      const senderSk = Buffer.from(senderSecretKey, 'base64');
      
      sodium.crypto_box_easy(ciphertext, message, nonce, recipientPk, senderSk);
      
      return {
        nonce: nonce.toString('base64'),
        ciphertext: ciphertext.toString('base64')
      };
    } catch (error) {
      throw new Error(`Device encryption failed: ${error.message}`);
    }
  }

  decryptFromDevice(encryptedData, senderPublicKey, recipientSecretKey) {
    try {
      const nonce = Buffer.from(encryptedData.nonce, 'base64');
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
      const senderPk = Buffer.from(senderPublicKey, 'base64');
      const recipientSk = Buffer.from(recipientSecretKey, 'base64');
      
      const message = Buffer.alloc(ciphertext.length - sodium.crypto_box_MACBYTES);
      
      if (!sodium.crypto_box_open_easy(message, ciphertext, nonce, senderPk, recipientSk)) {
        throw new Error('Device decryption verification failed');
      }
      
      return JSON.parse(message.toString('utf8'));
    } catch (error) {
      throw new Error(`Device decryption failed: ${error.message}`);
    }
  }
}

module.exports = { EncryptionService };