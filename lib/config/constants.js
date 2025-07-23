// Application constants
const APP_CONFIG = {
  PORT: process.env.PORT || 3003,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SESSION_SECRET: process.env.SESSION_SECRET || 'fallback-secret-replace-me!',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY
};

// Admin credentials
const ADMIN_CREDENTIALS = {
  username: 'admin',
  // This should be properly hashed in production
  password: '$2b$10$R4tMQGVYYReQayD82yx.6.E/4bE.0Ue.vmmWT6t1ggXrJFA3wUCqu' // Use bcrypt to generate this
};

// File upload configuration
const UPLOAD_CONFIG = {
  IMAGE_BUCKET: 'lesson-images',
  MAX_IMAGE_DIMENSION: 480,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

// Cache configuration
const CACHE_CONFIG = {
  DEFAULT_MAX_AGE: 60, // 1 minute
  LESSON_CACHE_MAX_AGE: 60 * 10, // 10 minutes
  STATISTICS_CACHE_MAX_AGE: 60 * 5, // 5 minutes
  RESULTS_CACHE_MAX_AGE: 60 * 60 * 24 // 24 hours
};

// Rating system configuration
const RATING_CONFIG = {
  DEFAULT_RATING: 1500,
  BASE_K_FACTOR: 32,
  MAX_TIME_BONUS: 300, // 5 minutes
  MAX_STREAK_MULTIPLIER: 10,
  STREAK_BONUS_RATE: 0.1
};

// API endpoints
const API_ENDPOINTS = {
  GEMINI_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
};

// Error messages
const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Invalid input data',
  INTERNAL_ERROR: 'Internal server error',
  SESSION_ERROR: 'Session error',
  DATABASE_ERROR: 'Database operation failed'
};

// Success messages
const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  REGISTRATION_SUCCESS: 'Registration successful! Please wait for admin approval.',
  UPDATE_SUCCESS: 'Update successful',
  DELETE_SUCCESS: 'Delete successful'
};

module.exports = {
  APP_CONFIG,
  ADMIN_CREDENTIALS,
  UPLOAD_CONFIG,
  CACHE_CONFIG,
  RATING_CONFIG,
  API_ENDPOINTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
};
