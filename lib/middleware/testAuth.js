const testAuthService = require('../services/testAuthService');
const logger = require('../utils/logger');

// Middleware to check for Playwright test authentication
const checkTestAuth = (req, res, next) => {
  // Only check in non-production or when explicitly allowed
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_AUTH) {
    return next();
  }

  // Check if this is a Playwright test request
  if (testAuthService.isPlaywrightTestRequest(req)) {
    // Setup test session
    if (testAuthService.setupTestSession(req)) {
      logger.info('Test authentication applied', {
        path: req.path,
        userType: req.testAuth.userType,
        testMode: true
      });
      
      // Mark response to indicate test mode
      res.setHeader('X-Test-Mode', 'true');
    }
  }

  next();
};

// Middleware to apply test auth early in the request pipeline
const applyTestAuth = (req, res, next) => {
  // This should be applied before session middleware
  // to ensure test sessions are properly initialized
  
  checkTestAuth(req, res, next);
};

// Modified auth middleware wrappers that respect test auth
const wrapAuthMiddleware = (originalMiddleware) => {
  return (req, res, next) => {
    // If test auth is active, bypass normal auth
    if (req.session?.testMode) {
      logger.debug('Bypassing auth check due to test mode');
      return next();
    }
    
    // Otherwise use original middleware
    return originalMiddleware(req, res, next);
  };
};

// Utility to generate test tokens for different scenarios
const generateTestTokens = () => {
  // Only allow in test environment
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_AUTH) {
    throw new Error('Test token generation not allowed in production');
  }

  return {
    adminToken: testAuthService.generateTestToken('admin'),
    studentToken: testAuthService.generateTestToken('student', {
      studentId: 1,
      studentName: 'Test Student',
      className: '12A1',
      school: 'Test High School'
    }),
    customStudentToken: (studentData) => testAuthService.generateTestToken('student', studentData)
  };
};

// API endpoint to get test tokens (only in test mode)
const testTokenEndpoint = (req, res) => {
  // Only allow in test environment
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_AUTH) {
    return res.status(403).json({ error: 'Test tokens not available in production' });
  }

  // Additional security: only allow from localhost
  const ip = req.ip || req.connection.remoteAddress;
  if (!ip.includes('127.0.0.1') && !ip.includes('::1') && !ip.includes('localhost')) {
    return res.status(403).json({ error: 'Test tokens only available from localhost' });
  }

  try {
    const tokens = generateTestTokens();
    res.json({
      success: true,
      tokens: {
        admin: tokens.adminToken,
        student: tokens.studentToken
      },
      usage: {
        header: 'x-playwright-test-token',
        userAgentHeader: 'x-playwright-test-user-agent',
        userAgentValue: 'playwright-test'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  checkTestAuth,
  applyTestAuth,
  wrapAuthMiddleware,
  generateTestTokens,
  testTokenEndpoint
};