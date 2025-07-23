const express = require('express');
const router = express.Router();
const adminEncryptionController = require('../lib/controllers/adminEncryptionController');
const { requireAdminAuth } = require('../lib/middleware/auth');
const { noCacheMiddleware } = require('../lib/middleware/cache');
const { addCSRFToken, validateCSRFToken } = require('../lib/middleware/csrf');

// All routes require admin authentication
router.use(requireAdminAuth);
router.use(noCacheMiddleware);
router.use(addCSRFToken);

// Get encryption status (admin only)
router.get('/status', adminEncryptionController.getEncryptionStatus);

// Toggle encryption on/off
router.post('/toggle', validateCSRFToken, adminEncryptionController.toggleEncryption);

// Public endpoint to check encryption status (no auth required)
router.get('/public-status', (req, res, next) => {
  // Remove admin auth requirement for this specific route
  next();
}, adminEncryptionController.getPublicEncryptionStatus);

module.exports = router;