const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../lib/controllers/authController');

// Import middleware
const { 
  validateAdminLogin, 
  validateStudentLogin, 
  validateStudentRegistration 
} = require('../lib/middleware/validation');
const { 
  requireAdminAuth, 
  requireStudentAuth, 
  requireNotAuthenticated,
  authRateLimit,
  logAuthEvent
} = require('../lib/middleware/auth');
const { noCacheMiddleware } = require('../lib/middleware/cache');

// Apply no-cache middleware to all auth routes
router.use(noCacheMiddleware);

// Admin authentication routes
router.post('/admin/login', 
  authRateLimit,
  logAuthEvent('admin_login_attempt'),
  requireNotAuthenticated,
  validateAdminLogin,
  authController.adminLogin
);

router.post('/admin/logout',
  requireAdminAuth,
  logAuthEvent('admin_logout'),
  authController.logout
);

router.get('/admin/check',
  authController.checkAdminAuth
);

// Student authentication routes
router.post('/student/login',
  authRateLimit,
  logAuthEvent('student_login_attempt'),
  requireNotAuthenticated,
  validateStudentLogin,
  authController.studentLogin
);

router.post('/student/register',
  authRateLimit,
  logAuthEvent('student_register_attempt'),
  requireNotAuthenticated,
  validateStudentRegistration,
  authController.studentRegister
);

router.post('/student/logout',
  requireStudentAuth,
  logAuthEvent('student_logout'),
  authController.logout
);

router.get('/student/check',
  authController.checkStudentAuth
);

// Alias for backward compatibility
router.get('/check-student-auth',
  authController.checkStudentAuth
);

// General authentication routes
router.post('/logout',
  logAuthEvent('logout'),
  authController.logout
);

router.get('/check',
  authController.checkAuth
);

router.get('/session',
  authController.getSessionInfo
);

router.post('/refresh',
  authController.refreshSession
);

// Password management routes
router.post('/change-password',
  authRateLimit,
  requireStudentAuth,
  logAuthEvent('password_change_attempt'),
  authController.changePassword
);

// Logout from all devices
router.post('/logout-all',
  requireStudentAuth,
  logAuthEvent('logout_all_devices'),
  authController.logoutAllDevices
);

// Device management routes
router.post('/validate-device',
  requireStudentAuth,
  authController.validateDevice
);

module.exports = router;
