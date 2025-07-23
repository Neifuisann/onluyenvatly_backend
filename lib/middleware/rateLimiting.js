const rateLimit = require('express-rate-limit');

/**
 * Rate Limiting Middleware Configuration
 * Implements different rate limits for different types of operations
 */

// General API rate limiting
const generalAPIRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Store rate limit data in memory (for production, consider Redis)
  store: undefined // Use default MemoryStore
});

// Strict rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth attempts per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many login attempts from this IP, please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests
  skipSuccessfulRequests: true
});

// Rate limiting for file uploads
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 upload attempts per windowMs
  message: {
    error: 'Too many upload attempts',
    message: 'Too many file upload attempts from this IP, please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for AI explanation requests
const aiRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // limit each IP to 20 AI requests per 5 minutes
  message: {
    error: 'Too many AI requests',
    message: 'Too many AI explanation requests, please try again later.',
    retryAfter: 300 // 5 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for quiz submissions
const quizRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // limit each IP to 30 quiz submissions per 5 minutes
  message: {
    error: 'Too many quiz submissions',
    message: 'Too many quiz submissions, please slow down.',
    retryAfter: 300 // 5 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for admin operations
const adminRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // limit each IP to 50 admin operations per 10 minutes
  message: {
    error: 'Too many admin requests',
    message: 'Too many admin operations, please try again later.',
    retryAfter: 600 // 10 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for password change operations
const passwordChangeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password changes per hour
  message: {
    error: 'Too many password change attempts',
    message: 'Too many password change attempts, please try again later.',
    retryAfter: 3600 // 1 hour in seconds
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Create a rate limiter for specific user sessions
const createSessionRateLimit = (maxRequests, windowMs, message) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      error: 'Rate limit exceeded',
      message,
      retryAfter: Math.floor(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use session ID as key instead of IP
    keyGenerator: (req) => {
      return req.sessionID || req.ip;
    }
  });
};

module.exports = {
  generalAPIRateLimit,
  authRateLimit,
  uploadRateLimit,
  aiRateLimit,
  quizRateLimit,
  adminRateLimit,
  passwordChangeRateLimit,
  createSessionRateLimit
};