const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Encryption Service for Test-Taking Application
 * Provides AES-256-GCM encryption for sensitive data transmission
 * Uses session-based keys for optimal performance and security
 */

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 32; // 256 bits for HMAC-SHA256
    this.saltLength = 32; // 256 bits for key derivation
  }

  /**
   * Generate a new encryption key for a session
   * @returns {Buffer} 256-bit encryption key
   */
  generateSessionKey() {
    return crypto.randomBytes(this.keyLength);
  }

  /**
   * Derive encryption key from session secret and salt
   * @param {string} sessionSecret - Session secret
   * @param {Buffer} salt - Salt for key derivation
   * @returns {Buffer} Derived encryption key
   */
  deriveKeyFromSession(sessionSecret, salt) {
    return crypto.pbkdf2Sync(sessionSecret, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Generate session-specific encryption context
   * @param {string} sessionId - Session identifier
   * @param {string} sessionSecret - Session secret
   * @returns {Object} Encryption context with key and salt
   */
  generateSessionContext(sessionId, sessionSecret) {
    const salt = crypto.randomBytes(this.saltLength);
    const key = this.deriveKeyFromSession(sessionSecret, salt);
    
    return {
      key,
      salt,
      sessionId,
      createdAt: Date.now()
    };
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {string|Object} data - Data to encrypt
   * @param {Buffer} key - Encryption key
   * @returns {Object} Encrypted data with metadata
   */
  encrypt(data, key) {
    try {
      // Convert data to string if it's an object
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

      // Ensure key is a Buffer
      const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key);

      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher with IV
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Create HMAC for authentication
      const encryptedBase64 = encrypted;
      const ivBase64 = iv.toString('base64');
      const hmac = crypto.createHmac('sha256', keyBuffer);
      hmac.update(encryptedBase64 + ivBase64, 'utf8');
      const tag = hmac.digest('base64');

      return {
        encrypted,
        iv: iv.toString('base64'),
        tag: tag,
        algorithm: 'aes-256-cbc',
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Encryption error', { error: error.message });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-CBC with HMAC
   * @param {Object} encryptedData - Encrypted data object
   * @param {Buffer} key - Decryption key
   * @returns {string|Object} Decrypted data
   */
  decrypt(encryptedData, key) {
    try {
      const { encrypted, iv, tag, algorithm } = encryptedData;

      // Ensure key is a Buffer
      const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key);

      // Validate algorithm
      if (algorithm !== 'aes-256-cbc') {
        throw new Error('Invalid encryption algorithm');
      }

      // Verify HMAC
      const hmac = crypto.createHmac('sha256', keyBuffer);
      hmac.update(encrypted + iv, 'utf8');
      const computedTag = hmac.digest('base64');

      if (computedTag !== tag) {
        throw new Error('Authentication failed - data may have been tampered with');
      }

      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, Buffer.from(iv, 'base64'));

      // Decrypt data
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      // Try to parse as JSON, return as string if it fails
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (error) {
      logger.error('Decryption error', { error: error.message });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt API response data
   * @param {Object} responseData - Response data to encrypt
   * @param {Buffer} key - Encryption key
   * @returns {Object} Encrypted response
   */
  encryptResponse(responseData, key) {
    const encryptedData = this.encrypt(responseData, key);
    
    return {
      encrypted: true,
      data: encryptedData,
      version: '1.0'
    };
  }

  /**
   * Decrypt API request data
   * @param {Object} requestData - Encrypted request data
   * @param {Buffer} key - Decryption key
   * @returns {Object} Decrypted request data
   */
  decryptRequest(requestData, key) {
    if (!requestData.encrypted || !requestData.data) {
      return requestData; // Not encrypted, return as-is
    }
    
    return this.decrypt(requestData.data, key);
  }

  /**
   * Check if data is encrypted
   * @param {Object} data - Data to check
   * @returns {boolean} True if data is encrypted
   */
  isEncrypted(data) {
    return data && typeof data === 'object' && data.encrypted === true && data.data;
  }

  /**
   * Generate nonce for anti-replay protection
   * @returns {string} Unique nonce
   */
  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate encryption context age
   * @param {Object} context - Encryption context
   * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
   * @returns {boolean} True if context is valid
   */
  isContextValid(context, maxAge = 24 * 60 * 60 * 1000) {
    if (!context || !context.createdAt) {
      return false;
    }
    
    return (Date.now() - context.createdAt) < maxAge;
  }

  /**
   * Rotate encryption key for a session
   * @param {Object} oldContext - Old encryption context
   * @param {string} sessionSecret - Session secret
   * @returns {Object} New encryption context
   */
  rotateSessionKey(oldContext, sessionSecret) {
    console.log(`🔄 Rotating encryption key for session: ${oldContext.sessionId}`);
    return this.generateSessionContext(oldContext.sessionId, sessionSecret);
  }

  /**
   * Create integrity hash for data verification
   * @param {string} data - Data to hash
   * @param {Buffer} key - Key for HMAC
   * @returns {string} HMAC hash
   */
  createIntegrityHash(data, key) {
    const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key);
    return crypto.createHmac('sha256', keyBuffer).update(data).digest('hex');
  }

  /**
   * Verify data integrity
   * @param {string} data - Original data
   * @param {string} hash - Expected hash
   * @param {Buffer} key - Key for HMAC
   * @returns {boolean} True if integrity is valid
   */
  verifyIntegrity(data, hash, key) {
    const computedHash = this.createIntegrityHash(data, key);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  }
}

module.exports = new EncryptionService();
