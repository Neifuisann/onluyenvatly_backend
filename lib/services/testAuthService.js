const crypto = require('crypto');
const logger = require('../utils/logger');

class TestAuthService {
  constructor() {
    this.TEST_TOKEN_HEADER = 'x-playwright-test-token';
    this.TEST_USER_AGENT = 'x-playwright-test-user-agent';
    
    // Generate a unique test secret on startup
    // This ensures tokens are only valid for the current server instance
    this.testSecret = process.env.PLAYWRIGHT_TEST_SECRET || crypto.randomBytes(32).toString('hex');
    
    // Store valid test tokens with expiration
    this.validTokens = new Map();
    
    // Clean up expired tokens every minute
    setInterval(() => this.cleanupExpiredTokens(), 60000);
  }

  // Generate a test token with user type and optional user data
  generateTestToken(userType, userData = {}) {
    // Only allow in test environment
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_AUTH) {
      throw new Error('Test authentication is not allowed in production');
    }

    const tokenData = {
      type: userType, // 'admin' or 'student'
      userData: userData,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    };

    // Create token signature
    const tokenString = JSON.stringify(tokenData);
    const signature = crypto
      .createHmac('sha256', this.testSecret)
      .update(tokenString)
      .digest('hex');

    const token = Buffer.from(JSON.stringify({
      data: tokenData,
      signature: signature
    })).toString('base64');

    // Store valid token with 1 hour expiration
    this.validTokens.set(token, {
      ...tokenData,
      expiresAt: Date.now() + (60 * 60 * 1000)
    });

    logger.info('Generated test token', { userType, tokenId: tokenData.nonce });

    return token;
  }

  // Validate test token
  validateTestToken(token) {
    // Check if token exists and hasn't expired
    const storedToken = this.validTokens.get(token);
    if (!storedToken) {
      return { valid: false, reason: 'Token not found' };
    }

    if (Date.now() > storedToken.expiresAt) {
      this.validTokens.delete(token);
      return { valid: false, reason: 'Token expired' };
    }

    // Verify token signature
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      const tokenString = JSON.stringify(decoded.data);
      const expectedSignature = crypto
        .createHmac('sha256', this.testSecret)
        .update(tokenString)
        .digest('hex');

      if (decoded.signature !== expectedSignature) {
        return { valid: false, reason: 'Invalid signature' };
      }

      return {
        valid: true,
        userType: decoded.data.type,
        userData: decoded.data.userData
      };
    } catch (error) {
      return { valid: false, reason: 'Invalid token format' };
    }
  }

  // Check if request is from Playwright test
  isPlaywrightTestRequest(req) {
    // Check for test token header
    const testToken = req.headers[this.TEST_TOKEN_HEADER];
    if (!testToken) {
      return false;
    }

    // Additional check: Playwright user agent pattern
    const userAgent = req.headers['user-agent'] || '';
    const testUserAgent = req.headers[this.TEST_USER_AGENT];
    
    // Must have either Playwright in user agent or special test user agent header
    const hasPlaywrightUA = userAgent.includes('Playwright') || 
                           userAgent.includes('HeadlessChrome') ||
                           testUserAgent === 'playwright-test';

    if (!hasPlaywrightUA) {
      logger.warn('Test token provided but user agent does not match Playwright pattern');
      return false;
    }

    // Validate the token
    const validation = this.validateTestToken(testToken);
    
    if (!validation.valid) {
      logger.warn('Invalid test token provided', { reason: validation.reason });
      return false;
    }

    // Attach test auth data to request
    req.testAuth = {
      isTest: true,
      userType: validation.userType,
      userData: validation.userData
    };

    return true;
  }

  // Setup test session based on test auth
  setupTestSession(req) {
    if (!req.testAuth) {
      return false;
    }

    const { userType, userData } = req.testAuth;

    // Initialize session if not exists
    if (!req.session) {
      req.session = {};
    }

    if (userType === 'admin') {
      req.session.isAuthenticated = true;
      req.session.testMode = true;
      req.session.adminUsername = userData.username || 'admin';
      logger.info('Test session created for admin');
    } else if (userType === 'student') {
      req.session.studentId = userData.studentId || 1; // Default test student ID
      req.session.studentName = userData.studentName || 'Test Student';
      req.session.studentInfo = userData.studentInfo || {
        name: userData.studentName || 'Test Student',
        className: userData.className || 'Test Class',
        school: userData.school || 'Test School'
      };
      req.session.testMode = true;
      logger.info('Test session created for student', { studentId: req.session.studentId });
    }

    return true;
  }

  // Clean up expired tokens
  cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of this.validTokens.entries()) {
      if (now > data.expiresAt) {
        this.validTokens.delete(token);
      }
    }
  }

  // Revoke a specific token
  revokeToken(token) {
    return this.validTokens.delete(token);
  }

  // Clear all tokens (useful for cleanup)
  clearAllTokens() {
    this.validTokens.clear();
  }

  // Get token statistics
  getTokenStats() {
    return {
      activeTokens: this.validTokens.size,
      tokens: Array.from(this.validTokens.values()).map(t => ({
        type: t.type,
        expiresAt: new Date(t.expiresAt).toISOString(),
        nonce: t.nonce
      }))
    };
  }
}

// Create singleton instance
const testAuthService = new TestAuthService();

module.exports = testAuthService;