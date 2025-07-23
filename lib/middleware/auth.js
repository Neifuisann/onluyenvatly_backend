const sessionService = require('../services/sessionService');
const { ERROR_MESSAGES } = require('../config/constants');

// Middleware to check if user is authenticated as admin
const requireAdminAuth = (req, res, next) => {
  if (!sessionService.isAdminAuthenticated(req)) {
    return res.status(401).json({ 
      error: ERROR_MESSAGES.UNAUTHORIZED,
      message: 'Admin authentication required' 
    });
  }
  next();
};

// Middleware to check if user is authenticated as student (or admin with student privileges)
const requireStudentAuth = (req, res, next) => {
  const isStudent = sessionService.isStudentAuthenticated(req);
  const isAdmin = sessionService.isAdminAuthenticated(req);
  const hasAccess = sessionService.isStudentOrAdminAuthenticated(req);

  // Debug logging
  console.log('[Auth Debug] requireStudentAuth check:', {
    endpoint: req.path,
    method: req.method,
    sessionId: req.sessionID,
    isStudent,
    isAdmin,
    hasAccess
  });

  if (!hasAccess) {
    console.log('[Auth Debug] Access denied in requireStudentAuth');
    return res.status(401).json({
      error: ERROR_MESSAGES.UNAUTHORIZED,
      message: 'Student authentication required'
    });
  }

  console.log('[Auth Debug] Access granted in requireStudentAuth');
  next();
};

// Middleware to check if student has required info
const requireStudentInfo = (req, res, next) => {
  const path = req.path;
  // Only check for lesson routes, not admin routes
  if (path.startsWith('/lesson/') && !path.includes('/admin/')) {
    if (!sessionService.hasStudentInfo(req)) {
      // Check if this is an HTML request or API request
      const isApiRequest = req.headers.accept && req.headers.accept.includes('application/json');

      if (isApiRequest) {
        return res.status(400).json({
          error: 'Student information required',
          message: 'Please provide student information first'
        });
      } else {
        // For HTML requests, redirect to home with error
        return res.redirect('/?error=no_student_info');
      }
    }
  }
  next();
};

// Middleware to check if user is authenticated (either admin or student)
const requireAuth = (req, res, next) => {
  if (!sessionService.isAdminAuthenticated(req) && !sessionService.isStudentAuthenticated(req)) {
    return res.status(401).json({ 
      error: ERROR_MESSAGES.UNAUTHORIZED,
      message: 'Authentication required' 
    });
  }
  next();
};

// Middleware to optionally authenticate (doesn't fail if not authenticated)
const optionalAuth = (req, res, next) => {
  // Just validate session integrity if session exists
  if (req.session) {
    sessionService.cleanupSession(req);
  }
  next();
};

// Middleware to check admin or student owner access
const requireAdminOrOwner = (req, res, next) => {
  const isAdmin = sessionService.isAdminAuthenticated(req);
  const isStudent = sessionService.isStudentAuthenticated(req);
  
  // Debug logging
  console.log('[Auth Debug] requireAdminOrOwner check:', {
    endpoint: req.path,
    method: req.method,
    isAdmin,
    isStudent,
    sessionId: req.sessionID,
    studentIdInSession: req.session?.studentId,
    requestedStudentId: req.params.studentId || req.body.studentId || req.query.studentId
  });
  
  if (!isAdmin && !isStudent) {
    console.log('[Auth Debug] Access denied: No authentication');
    return res.status(401).json({ 
      error: ERROR_MESSAGES.UNAUTHORIZED,
      message: 'Authentication required' 
    });
  }

  // If student, check if they're accessing their own data
  if (isStudent && !isAdmin) {
    const studentId = req.session.studentId;
    const requestedStudentId = req.params.studentId || req.body.studentId || req.query.studentId;
    
    // Convert both to strings for comparison to handle type mismatches
    if (requestedStudentId && String(requestedStudentId) !== String(studentId)) {
      console.log('[Auth Debug] Access denied: Student ID mismatch', {
        sessionStudentId: studentId,
        requestedStudentId: requestedStudentId,
        typeOfSession: typeof studentId,
        typeOfRequested: typeof requestedStudentId
      });
      return res.status(403).json({ 
        error: ERROR_MESSAGES.FORBIDDEN,
        message: 'Access denied: can only access own data' 
      });
    }
  }

  console.log('[Auth Debug] Access granted');
  next();
};

// Middleware to validate session integrity
const validateSession = (req, res, next) => {
  if (req.session) {
    if (!sessionService.validateSessionIntegrity(req)) {
      sessionService.clearSession(req);
      return res.status(401).json({ 
        error: ERROR_MESSAGES.SESSION_ERROR,
        message: 'Session integrity check failed' 
      });
    }
  }
  next();
};

// Middleware to add session info to request
const addSessionInfo = (req, res, next) => {
  req.sessionInfo = sessionService.getSessionData(req);
  next();
};

// Middleware to prevent access for already authenticated users
const requireNotAuthenticated = (req, res, next) => {
  // Check if user is already authenticated as admin
  if (sessionService.isAdminAuthenticated(req)) {
    // If trying to login as admin again, just redirect to admin dashboard
    if (req.path.includes('/admin/login')) {
      return res.json({
        success: true,
        message: 'Already logged in as admin',
        redirect: '/admin'
      });
    }
    // If trying to login as student while admin, clear admin session first
    sessionService.clearSession(req);
  }

  // Check if user is already authenticated as student
  if (sessionService.isStudentAuthenticated(req)) {
    // If trying to login as student again, allow re-authentication (clear existing session)
    if (req.path.includes('/student/login')) {
      sessionService.clearSession(req);
    }
    // If trying to login as admin while student, clear student session first
    else if (req.path.includes('/admin/login')) {
      sessionService.clearSession(req);
    }
  }

  next();
};

// Middleware to check device authentication for students
const requireDeviceAuth = (req, res, next) => {
  if (!sessionService.isStudentAuthenticated(req)) {
    return res.status(401).json({ 
      error: ERROR_MESSAGES.UNAUTHORIZED,
      message: 'Student authentication required' 
    });
  }

  // Check if device identifier is present in session or request
  const deviceId = req.headers['x-device-id'] || req.body.deviceId || req.query.deviceId;
  
  if (!deviceId) {
    return res.status(400).json({ 
      error: 'Device identification required',
      message: 'Device identifier missing' 
    });
  }

  // Add device info to request for further processing
  req.deviceId = deviceId;
  next();
};

// Middleware to log authentication events
const logAuthEvent = (eventType) => {
  return (req, res, next) => {
    const sessionInfo = sessionService.getSessionData(req);
    const userInfo = sessionInfo.isAuthenticated ? 'admin' : 
                    sessionInfo.studentId ? `student:${sessionInfo.studentId}` : 'anonymous';
    
    console.log(`🔐 Auth Event: ${eventType} - User: ${userInfo} - IP: ${req.ip} - UA: ${req.get('User-Agent')?.substring(0, 50)}...`);
    next();
  };
};

// Middleware to rate limit authentication attempts
const authRateLimit = (() => {
  const attempts = new Map();
  const MAX_ATTEMPTS = 10;
  const WINDOW_MS = 5 * 60 * 1000; // 15 minutes

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    
    if (!attempts.has(key)) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    const record = attempts.get(key);
    
    // Reset if window has passed
    if (now - record.firstAttempt > WINDOW_MS) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    // Check if limit exceeded
    if (record.count >= MAX_ATTEMPTS) {
      return res.status(429).json({
        error: 'Too many authentication attempts',
        message: 'Please try again later',
        retryAfter: Math.ceil((WINDOW_MS - (now - record.firstAttempt)) / 1000)
      });
    }

    // Increment counter
    record.count++;
    next();
  };
})();

// Middleware to extend session on activity
const extendSessionOnActivity = (req, res, next) => {
  if (req.session) {
    // Only extend for authenticated users
    if (sessionService.isAdminAuthenticated(req) || sessionService.isStudentAuthenticated(req)) {
      sessionService.extendSessionOnActivity(req);
    }
  }
  next();
};

module.exports = {
  requireAdminAuth,
  requireStudentAuth,
  requireStudentInfo,
  requireAuth,
  optionalAuth,
  requireAdminOrOwner,
  validateSession,
  addSessionInfo,
  requireNotAuthenticated,
  requireDeviceAuth,
  logAuthEvent,
  authRateLimit,
  extendSessionOnActivity
};
