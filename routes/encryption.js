const express = require('express');
const router = express.Router();
const sessionService = require('../lib/services/sessionService');
const { requireAuth } = require('../lib/middleware/auth');
const { noCacheMiddleware } = require('../lib/middleware/cache');
const { addCSRFToken } = require('../lib/middleware/csrf');

/**
 * Encryption Routes for Key Exchange and Management
 * Provides secure key exchange for client-side encryption
 */

/**
 * @route POST /api/encryption/init
 * @desc Initialize encryption for the current session
 * @access Private (Authenticated users only)
 */
router.post('/init',
  requireAuth,
  addCSRFToken,
  noCacheMiddleware,
  async (req, res) => {
    try {
      // Generate or get encryption context for the session
      const context = sessionService.generateEncryptionContext(req);
      
      if (!context) {
        return res.status(500).json({
          success: false,
          error: 'Failed to initialize encryption',
          message: 'Could not generate encryption context'
        });
      }

      // Return the encryption key (base64 encoded) to the client
      // Note: This is secure because it's sent over HTTPS and tied to the session
      res.json({
        success: true,
        message: 'Encryption initialized successfully',
        encryptionKey: context.key.toString('base64'),
        algorithm: 'AES-CBC',
        version: '1.0'
      });

      console.log(`🔑 Encryption key provided to client for session: ${req.sessionID}`);
      
    } catch (error) {
      console.error('❌ Encryption initialization error:', error);
      res.status(500).json({
        success: false,
        error: 'Encryption initialization failed',
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route POST /api/encryption/rotate
 * @desc Rotate encryption key for the current session
 * @access Private (Authenticated users only)
 */
router.post('/rotate',
  requireAuth,
  noCacheMiddleware,
  async (req, res) => {
    try {
      // Rotate the encryption key
      const newContext = sessionService.rotateEncryptionKey(req);
      
      if (!newContext) {
        return res.status(500).json({
          success: false,
          error: 'Key rotation failed',
          message: 'Could not rotate encryption key'
        });
      }

      res.json({
        success: true,
        message: 'Encryption key rotated successfully',
        encryptionKey: newContext.key.toString('base64'),
        algorithm: 'AES-CBC',
        version: '1.0'
      });

      console.log(`🔄 Encryption key rotated for session: ${req.sessionID}`);
      
    } catch (error) {
      console.error('❌ Key rotation error:', error);
      res.status(500).json({
        success: false,
        error: 'Key rotation failed',
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route GET /api/encryption/status
 * @desc Check encryption status for the current session
 * @access Private (Authenticated users only)
 */
router.get('/status',
  requireAuth,
  noCacheMiddleware,
  async (req, res) => {
    try {
      const hasValidContext = sessionService.hasValidEncryptionContext(req);
      const context = sessionService.getEncryptionContext(req);
      
      res.json({
        success: true,
        encryptionEnabled: hasValidContext,
        contextAge: context ? Date.now() - context.createdAt : null,
        algorithm: 'AES-CBC',
        version: '1.0'
      });
      
    } catch (error) {
      console.error('❌ Encryption status check error:', error);
      res.status(500).json({
        success: false,
        error: 'Status check failed',
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route DELETE /api/encryption/clear
 * @desc Clear encryption context for the current session
 * @access Private (Authenticated users only)
 */
router.delete('/clear',
  requireAuth,
  noCacheMiddleware,
  async (req, res) => {
    try {
      sessionService.clearEncryptionContext(req);
      
      res.json({
        success: true,
        message: 'Encryption context cleared successfully'
      });

      console.log(`🗑️ Encryption context cleared for session: ${req.sessionID}`);
      
    } catch (error) {
      console.error('❌ Encryption clear error:', error);
      res.status(500).json({
        success: false,
        error: 'Clear operation failed',
        message: 'Internal server error'
      });
    }
  }
);

module.exports = router;
