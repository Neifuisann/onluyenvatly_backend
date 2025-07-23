const crypto = require('crypto');
const { ValidationError } = require('./errorHandler');

/**
 * CSRF Protection Middleware
 * Implements token-based CSRF protection
 */

// Generate a CSRF token
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Get or create CSRF token for session
const getCSRFToken = (req) => {
  if (!req.session.csrfToken) {
    const newToken = generateCSRFToken();
    req.session.csrfToken = newToken;
    console.log('[CSRF Debug] Generated new CSRF token for session:', {
      sessionId: req.session?.id,
      tokenLength: newToken.length
    });
  }
  return req.session.csrfToken;
};

// Middleware to add CSRF token to requests
const addCSRFToken = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Generate token and add to response locals for templates
  const token = getCSRFToken(req);
  res.locals.csrfToken = token;
  
  // Add CSRF token to API responses
  const originalJson = res.json;
  res.json = function(data) {
    if (data && typeof data === 'object' && !data.csrfToken) {
      data.csrfToken = token;
    }
    return originalJson.call(this, data);
  };
  
  next();
};

// Middleware to validate CSRF token
const validateCSRFToken = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for certain public endpoints
  const skipPaths = [
    '/auth/student/login',
    '/auth/admin/login',
    '/webhooks/', // Supabase webhooks
    '/supabase/', // Supabase callbacks
    '/database/webhooks' // Database webhooks
  ];

  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Debug logging for CSRF validation
  console.log('[CSRF Debug] Validating request:', {
    path: req.path,
    method: req.method,
    hasSession: !!req.session,
    sessionId: req.session?.id,
    hasSessionToken: !!req.session?.csrfToken,
    requestTokenInBody: !!req.body?.csrfToken,
    requestTokenInHeader: !!req.headers['x-csrf-token'],
    headers: Object.keys(req.headers),
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
  
  const sessionToken = req.session.csrfToken;
  const requestToken = req.body.csrfToken || req.headers['x-csrf-token'];
  
  if (!sessionToken) {
    console.error('[CSRF Debug] No CSRF token in session:', {
      sessionId: req.session?.id,
      sessionKeys: req.session ? Object.keys(req.session) : []
    });
    throw new ValidationError('CSRF token not found in session');
  }
  
  if (!requestToken) {
    console.error('[CSRF Debug] No CSRF token in request:', {
      bodyToken: req.body?.csrfToken,
      headerToken: req.headers['x-csrf-token'],
      allHeaders: req.headers
    });
    throw new ValidationError('CSRF token not provided');
  }
  
  // Use timing-safe comparison
  if (!crypto.timingSafeEqual(Buffer.from(sessionToken, 'hex'), Buffer.from(requestToken, 'hex'))) {
    throw new ValidationError('Invalid CSRF token');
  }
  
  next();
};

// Get CSRF token endpoint
const getCSRFTokenEndpoint = (req, res) => {
  const token = getCSRFToken(req);
  res.json({
    success: true,
    csrfToken: token
  });
};

module.exports = {
  generateCSRFToken,
  getCSRFToken,
  addCSRFToken,
  validateCSRFToken,
  getCSRFTokenEndpoint
};