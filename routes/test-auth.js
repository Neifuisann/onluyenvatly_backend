const express = require('express');
const router = express.Router();
const testAuthService = require('../lib/services/testAuthService');
const logger = require('../lib/utils/logger');

// Only enable test routes in non-production environments
if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_TEST_AUTH) {
  
  // GET /api/test-tokens - Generate test authentication tokens
  router.get('/test-tokens', (req, res) => {
    try {
      // Check if request is from Playwright or test environment
      const userAgent = req.headers['user-agent'] || '';
      const isTestEnvironment = userAgent.includes('Playwright') || 
                               userAgent.includes('Test') ||
                               process.env.NODE_ENV === 'test' ||
                               process.env.NODE_ENV === 'development';
      
      if (!isTestEnvironment) {
        return res.status(403).json({
          success: false,
          error: 'Test tokens only available in test environment'
        });
      }

      // Generate tokens for both admin and student
      const adminToken = testAuthService.generateTestToken('admin', {
        username: 'admin'
      });
      
      const studentToken = testAuthService.generateTestToken('student', {
        studentId: 1,
        studentName: 'Test Student',
        className: '12A1',
        school: 'Test School'
      });

      logger.info('Test tokens generated for Playwright tests');

      res.json({
        success: true,
        tokens: {
          admin: adminToken,
          student: studentToken
        },
        usage: {
          header: testAuthService.TEST_TOKEN_HEADER,
          userAgentHeader: testAuthService.TEST_USER_AGENT,
          instructions: 'Set the token in x-playwright-test-token header'
        }
      });
    } catch (error) {
      logger.error('Error generating test tokens:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate test tokens'
      });
    }
  });

  // GET /api/test-auth/stats - Get test token statistics
  router.get('/test-auth/stats', (req, res) => {
    try {
      const stats = testAuthService.getTokenStats();
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Error getting test auth stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get test auth stats'
      });
    }
  });

  // POST /api/test-auth/revoke - Revoke a test token
  router.post('/test-auth/revoke', (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token required'
        });
      }

      const revoked = testAuthService.revokeToken(token);
      res.json({
        success: true,
        revoked
      });
    } catch (error) {
      logger.error('Error revoking test token:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke test token'
      });
    }
  });

  // POST /api/test-auth/clear - Clear all test tokens
  router.post('/test-auth/clear', (req, res) => {
    try {
      testAuthService.clearAllTokens();
      res.json({
        success: true,
        message: 'All test tokens cleared'
      });
    } catch (error) {
      logger.error('Error clearing test tokens:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear test tokens'
      });
    }
  });

} else {
  // Production environment - disable test routes
  router.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Test authentication not available in production'
    });
  });
}

module.exports = router;