const express = require('express');
const router = express.Router();

// Import controllers
const settingsController = require('../lib/controllers/settingsController');

// Import middleware
const { 
  validateIdParam 
} = require('../lib/middleware/validation');
const { 
  requireStudentAuth 
} = require('../lib/middleware/auth');
const { shortCacheMiddleware, noCacheMiddleware } = require('../lib/middleware/cache');

// Student settings routes - all require authentication

// Get student settings
router.get('/student',
  requireStudentAuth,
  shortCacheMiddleware(300), // 5 minutes cache
  settingsController.getStudentSettings
);

// Update student settings
router.put('/student',
  requireStudentAuth,
  noCacheMiddleware,
  settingsController.updateStudentSettings
);

// Update privacy settings
router.put('/student/privacy',
  requireStudentAuth,
  noCacheMiddleware,
  settingsController.updatePrivacySettings
);

// Avatar management routes

// Upload avatar
router.post('/student/avatar',
  requireStudentAuth,
  noCacheMiddleware,
  settingsController.uploadAvatar
);

// Remove avatar
router.delete('/student/avatar',
  requireStudentAuth,
  noCacheMiddleware,
  settingsController.removeAvatar
);

// Device management routes

// Get student devices
router.get('/student/devices',
  requireStudentAuth,
  noCacheMiddleware, // Don't cache device info for security
  settingsController.getStudentDevices
);

// Remove specific device
router.delete('/student/devices/:deviceId',
  requireStudentAuth,
  validateIdParam('deviceId'),
  noCacheMiddleware,
  settingsController.removeDevice
);

// Data management routes

// Export student data
router.get('/student/export-data',
  requireStudentAuth,
  noCacheMiddleware,
  settingsController.exportStudentData
);

// Get usage statistics
router.get('/student/statistics',
  requireStudentAuth,
  shortCacheMiddleware(600), // 10 minutes cache
  settingsController.getUsageStatistics
);

// Account management routes

// Request account deletion
router.post('/student/delete-request',
  requireStudentAuth,
  noCacheMiddleware,
  settingsController.requestAccountDeletion
);

// Logout from all devices
router.post('/student/logout-all',
  requireStudentAuth,
  noCacheMiddleware,
  settingsController.logoutAllDevices
);

module.exports = router;