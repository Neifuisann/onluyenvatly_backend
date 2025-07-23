const { ERROR_MESSAGES, APP_CONFIG } = require('../config/constants');
const cacheService = require('../services/cacheService');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = ERROR_MESSAGES.UNAUTHORIZED) {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = ERROR_MESSAGES.FORBIDDEN) {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = ERROR_MESSAGES.NOT_FOUND) {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

class DatabaseError extends AppError {
  constructor(message = ERROR_MESSAGES.DATABASE_ERROR) {
    super(message, 500, 'DATABASE_ERROR');
  }
}

// Error logging utility
const logError = (error, req = null) => {
  const timestamp = new Date().toISOString();
  const requestInfo = req ? {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    sessionId: req.sessionID
  } : {};

  console.error('🚨 Error occurred:', {
    timestamp,
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    code: error.code,
    request: requestInfo
  });
};

// Main error handler middleware
const errorHandler = (error, req, res, next) => {
  // Clear any cache headers for error responses
  cacheService.clearCacheHeaders(res);

  // Log the error
  logError(error, req);

  // Handle different types of errors
  let statusCode = 500;
  let message = ERROR_MESSAGES.INTERNAL_ERROR;
  let code = 'INTERNAL_ERROR';
  let details = null;

  if (error.isOperational) {
    // Operational errors (known errors)
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
    details = error.details;
  } else if (error.name === 'ValidationError') {
    // Mongoose/validation errors
    statusCode = 400;
    message = ERROR_MESSAGES.VALIDATION_ERROR;
    code = 'VALIDATION_ERROR';
    details = Object.values(error.errors).map(err => err.message);
  } else if (error.name === 'CastError') {
    // Database cast errors (invalid IDs)
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
  } else if (error.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 400;
    message = 'Duplicate entry';
    code = 'DUPLICATE_ERROR';
  } else if (error.name === 'JsonWebTokenError') {
    // JWT errors
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    // JWT expiration
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  } else if (error.code === 'ECONNREFUSED') {
    // Database connection errors
    statusCode = 503;
    message = 'Service temporarily unavailable';
    code = 'SERVICE_UNAVAILABLE';
  }

  // Prepare error response
  const errorResponse = {
    error: message,
    code: code,
    timestamp: new Date().toISOString()
  };

  // Add details in development mode or for validation errors
  if (APP_CONFIG.NODE_ENV === 'development' || details) {
    errorResponse.details = details;
  }

  // Add stack trace in development mode
  if (APP_CONFIG.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// 404 handler for unmatched routes
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Database error handler
const handleDatabaseError = (error) => {
  if (error.code === 'PGRST116') {
    return new NotFoundError('Resource not found');
  }
  
  if (error.code === '23505') {
    return new ValidationError('Duplicate entry', ['This record already exists']);
  }
  
  if (error.code === '23503') {
    return new ValidationError('Foreign key constraint violation', ['Referenced record does not exist']);
  }
  
  if (error.code === '23502') {
    return new ValidationError('Required field missing', ['A required field is missing']);
  }

  return new DatabaseError(`Database operation failed: ${error.message}`);
};

// Rate limiting error handler
const rateLimitHandler = (req, res, next) => {
  const error = new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
  next(error);
};

// File upload error handler
const uploadErrorHandler = (error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    const sizeError = new ValidationError('File too large', ['File size exceeds the maximum limit']);
    return next(sizeError);
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    const countError = new ValidationError('Too many files', ['Number of files exceeds the limit']);
    return next(countError);
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    const fieldError = new ValidationError('Unexpected file field', ['File uploaded to unexpected field']);
    return next(fieldError);
  }

  next(error);
};

// Session error handler
const sessionErrorHandler = (error, req, res, next) => {
  if (error.code === 'SESSION_ERROR') {
    // Clear the problematic session
    if (req.session) {
      req.session.destroy(() => {
        const sessionError = new AuthenticationError('Session error, please login again');
        next(sessionError);
      });
    } else {
      const sessionError = new AuthenticationError('Session error, please login again');
      next(sessionError);
    }
  } else {
    next(error);
  }
};

// Global uncaught exception handler
const handleUncaughtException = () => {
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    console.error('Shutting down...');
    process.exit(1);
  });
};

// Global unhandled rejection handler
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    console.error('Shutting down...');
    process.exit(1);
  });
};

// Error monitoring middleware
const errorMonitoring = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    if (statusCode >= 400) {
      console.log(`⚠️  Error Response: ${req.method} ${req.path} - ${statusCode} - ${duration}ms`);
    }
  });
  
  next();
};

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  
  // Error handlers
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleDatabaseError,
  rateLimitHandler,
  uploadErrorHandler,
  sessionErrorHandler,
  errorMonitoring,
  
  // Global handlers
  handleUncaughtException,
  handleUnhandledRejection,
  
  // Utilities
  logError
};
