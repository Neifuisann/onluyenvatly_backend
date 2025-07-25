// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');
// const { inject } = require('@vercel/analytics');

// Import configuration modules
const { sessionConfig, sessionStore } = require('../lib/config/session');
const { UPLOAD_CONFIG } = require('../lib/config/constants');

// Import middleware
const { errorHandler } = require('../lib/middleware/errorHandler');

// Import route modules from root routes directory (outside api/ to avoid Vercel function limits)
const authRoutes = require('../routes/auth');
const studentRoutes = require('../routes/students');
const lessonRoutes = require('../routes/lessons');
const ratingRoutes = require('../routes/ratings');
const uploadRoutes = require('../routes/uploads');
const resultRoutes = require('../routes/results');
const galleryRoutes = require('../routes/gallery');
const tagsRoutes = require('../routes/tags');
const explainRoutes = require('../routes/explain');
const adminRoutes = require('../routes/admin');
const historyRoutes = require('../routes/history');
const progressRoutes = require('../routes/progress');
const settingsRoutes = require('../routes/settings');
const streakRoutes = require('../routes/streaks');
const webhookRoutes = require('../routes/webhooks');
const materialsRoutes = require('../routes/materials');

// Import utilities
const logger = require('../lib/utils/logger');

// Import services that need initialization
const sessionService = require('../lib/services/sessionService');

const app = express();
const PORT = process.env.PORT || 3003;

// --- Global Error Handling ---
process.on('uncaughtException', (error) => {
  logger.error('FATAL: Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('FATAL: Unhandled Rejection', { reason, promise });
});
// --- End Global Error Handling ---

// Initialize Vercel Analytics
// inject();

// Set proper charset for all responses
app.use((req, res, next) => {
    res.charset = 'utf-8';
    next();
});


// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const responseTime = Date.now() - start;
        logger.logRequest(req, res, responseTime);
    });

    next();
});

// Add compression middleware for better performance
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024 // Only compress responses above 1KB
}));

// Configure CORS for API access
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In production, you should specify allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001']; // Default for development
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token']
};

app.use(cors(corsOptions));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true, parameterLimit: 50000 }));

// Import test auth middleware
const { applyTestAuth, testTokenEndpoint } = require('../lib/middleware/testAuth');

// Apply test auth before session middleware
app.use(applyTestAuth);

// Configure express-session
app.set('trust proxy', 1); // Trust first proxy, crucial for Vercel/Heroku/etc.
app.use(sessionConfig);

// Initialize session service with session store
sessionService.initialize(sessionStore);

// Session cleanup middleware
app.use((req, res, next) => {
    if (req.session) {
        sessionService.cleanupSession(req);
    }
    next();
});

// Add CSRF protection
const { addCSRFToken, validateCSRFToken, getCSRFTokenEndpoint } = require('../lib/middleware/csrf');
app.use(addCSRFToken);

// CSRF token endpoint
app.get('/api/csrf-token', getCSRFTokenEndpoint);

// Test token endpoint (only in test mode)
app.get('/api/test-tokens', (req, res, next) => {
  // Check if test auth is explicitly enabled
  const isTestAuthEnabled = process.env.ALLOW_TEST_AUTH === 'true';
  
  if (!isTestAuthEnabled) {
    return res.status(403).json({ 
      error: 'Test authentication not available - ALLOW_TEST_AUTH must be set to true' 
    });
  }
  
  return testTokenEndpoint(req, res, next);
});

// Add CSRF validation for API routes (except login endpoints)
app.use('/api', validateCSRFToken);

// Add rate limiting to API routes
const { generalAPIRateLimit } = require('../lib/middleware/rateLimiting');
app.use('/api', generalAPIRateLimit);

// Add session extension middleware for API routes
const { extendSessionOnActivity } = require('../lib/middleware/auth');
app.use('/api', extendSessionOnActivity);

// Setup API routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/explain', explainRoutes);
app.use('/api/ai', require('../routes/ai'));
app.use('/api/admin', adminRoutes);
app.use('/api/admin/encryption', require('../routes/adminEncryption'));
app.use('/api/history', historyRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/streaks', streakRoutes);
app.use('/api/encryption', require('../routes/encryption'));
app.use('/api/webhooks', webhookRoutes);
app.use('/api/materials', materialsRoutes);


// Duplicate auth routes removed - now handled by /api/auth/* routes

// Student info endpoints for session storage (supports admin as student)
app.get('/api/student-info', (req, res) => {
  const sessionData = sessionService.getSessionData(req);
  const isAdmin = sessionService.isAdminAuthenticated(req);

  if (sessionData.studentId) {
    res.json({
      success: true,
      student: {
        id: sessionData.studentId,
        name: sessionData.studentName
      }
    });
  } else if (isAdmin) {
    // Provide admin as student info for compatibility
    res.json({
      success: true,
      student: {
        id: 'admin',
        name: 'Administrator'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'No student session found'
    });
  }
});

// Session management endpoints
app.post('/api/auth/refresh', (req, res) => {
  sessionService.refreshSession(req, (err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to refresh session'
      });
    }
    
    res.json({
      success: true,
      message: 'Session refreshed successfully',
      timeRemaining: sessionService.getSessionTimeRemaining(req)
    });
  });
});

// Get session status
app.get('/api/auth/session-status', (req, res) => {
  const sessionData = sessionService.getSessionData(req);
  const timeRemaining = sessionService.getSessionTimeRemaining(req);
  const nearExpiry = sessionService.isSessionNearExpiry(req);
  
  res.json({
    success: true,
    data: {
      ...sessionData,
      timeRemaining,
      nearExpiry,
      timeRemainingFormatted: Math.ceil(timeRemaining / (60 * 1000)) + ' minutes'
    }
  });
});

// Student info session endpoint (for backward compatibility)
app.post('/api/student-info', (req, res) => {
    req.session.studentInfo = req.body;
    res.json({ success: true });
});

// Temporary cache clear endpoint for development
app.get('/api/clear-cache', (_req, res) => {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
    res.json({ message: 'Cache cleared' });
});

// View routes already registered above

// 404 handler for unmatched routes
app.use('*', (req, res) => {
    logger.warn('404 Not Found', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });

    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

module.exports = app;