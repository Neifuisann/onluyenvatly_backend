const express = require('express');
const router = express.Router();

// Import controllers
const studentController = require('../lib/controllers/studentController');

// Import services
const sessionService = require('../lib/services/sessionService');

// Import middleware
const { 
  validateIdParam,
  validatePagination 
} = require('../lib/middleware/validation');
const { 
  requireAdminAuth, 
  requireStudentAuth,
  requireAdminOrOwner 
} = require('../lib/middleware/auth');
const { shortCacheMiddleware, noCacheMiddleware } = require('../lib/middleware/cache');

// Admin-only routes for student management
router.get('/',
  requireAdminAuth,
  validatePagination,
  shortCacheMiddleware(300), // 5 minutes cache
  studentController.getAllStudents
);

router.get('/pending',
  requireAdminAuth,
  noCacheMiddleware,
  studentController.getPendingStudents
);

router.get('/approved',
  requireAdminAuth,
  shortCacheMiddleware(300), // 5 minutes cache
  studentController.getApprovedStudents
);

router.post('/:studentId/approve',
  requireAdminAuth,
  validateIdParam('studentId'),
  noCacheMiddleware,
  studentController.approveStudent
);

router.post('/:studentId/reject',
  requireAdminAuth,
  validateIdParam('studentId'),
  noCacheMiddleware,
  studentController.rejectStudent
);

router.delete('/:studentId',
  requireAdminAuth,
  validateIdParam('studentId'),
  noCacheMiddleware,
  studentController.deleteStudent
);

router.post('/:studentId/reset-password',
  requireAdminAuth,
  validateIdParam('studentId'),
  noCacheMiddleware,
  studentController.resetStudentPassword
);

// Test endpoint for debugging
router.get('/profile-test',
  requireStudentAuth,
  (req, res) => {
    const sessionData = sessionService.getSessionData(req);
    const isAdmin = sessionService.isAdminAuthenticated(req);

    res.json({
      success: true,
      debug: {
        sessionId: req.sessionID,
        studentId: sessionData.studentId,
        isAdmin,
        hasStudentId: !!sessionData.studentId,
        sessionData
      }
    });
  }
);

// Student profile routes (any authenticated student can view any profile)
router.get('/profile',
  requireStudentAuth,
  shortCacheMiddleware(600), // 10 minutes cache
  studentController.getCurrentStudentProfile
);

router.get('/:studentId/profile',
  requireStudentAuth,
  validateIdParam('studentId'),
  shortCacheMiddleware(600), // 10 minutes cache
  studentController.getStudentProfile
);

router.put('/:studentId/profile',
  requireAdminOrOwner,
  validateIdParam('studentId'),
  noCacheMiddleware,
  studentController.updateStudentProfile
);

router.get('/:studentId/statistics',
  requireStudentAuth,
  validateIdParam('studentId'),
  shortCacheMiddleware(300), // 5 minutes cache
  studentController.getStudentStatistics
);

router.get('/:studentId/activity',
  requireStudentAuth,
  validateIdParam('studentId'),
  validatePagination,
  shortCacheMiddleware(300), // 5 minutes cache
  studentController.getStudentActivity
);

// Device management routes
router.put('/:studentId/device',
  requireAdminOrOwner,
  validateIdParam('studentId'),
  noCacheMiddleware,
  studentController.updateDeviceInfo
);

// Student info session management
router.post('/info',
  requireStudentAuth,
  noCacheMiddleware,
  studentController.setStudentInfo
);

router.get('/info',
  requireStudentAuth,
  noCacheMiddleware,
  studentController.getStudentInfo
);

// Avatar management routes
router.post('/avatar',
  requireStudentAuth,
  noCacheMiddleware,
  studentController.uploadAvatar
);

router.delete('/avatar',
  requireStudentAuth,
  noCacheMiddleware,
  studentController.removeAvatar
);

// Device management routes
router.get('/devices',
  requireStudentAuth,
  noCacheMiddleware,
  studentController.getDevices
);

router.delete('/devices/:deviceId',
  requireStudentAuth,
  validateIdParam('deviceId'),
  noCacheMiddleware,
  studentController.removeDevice
);

// Data export route
router.get('/export-data',
  requireStudentAuth,
  noCacheMiddleware,
  studentController.exportData
);

// Account deletion request
router.post('/delete-request',
  requireStudentAuth,
  noCacheMiddleware,
  studentController.requestAccountDeletion
);

module.exports = router;
