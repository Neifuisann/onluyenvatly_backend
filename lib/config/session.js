const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pgPool } = require('./database');

// Create PostgreSQL Session Store
const sessionStore = new pgSession({
  pool: pgPool,                // Connection pool
  tableName: 'session',        // Use the table created earlier
  createTableIfMissing: false, // We created it manually
  pruneSessionInterval: 900    // Clean expired sessions every 15 minutes
});

// Get session timeout from environment (default 24 hours)
const getSessionTimeout = () => {
  const timeoutHours = parseInt(process.env.SESSION_TIMEOUT_HOURS) || 24;
  return timeoutHours * 60 * 60 * 1000; // Convert to milliseconds
};

// Session configuration
const sessionConfig = session({
  store: sessionStore, // Use the PostgreSQL store
  secret: process.env.SESSION_SECRET || 'fallback-secret-replace-me!',
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something stored
  rolling: true, // Enable rolling sessions - extends session on each request
  name: 'connect.sid', // Session cookie name
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent client-side JS access
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-origin for API
    path: '/', // Valid for all paths
    maxAge: getSessionTimeout() // Dynamic session timeout
  },
  proxy: true // Trust reverse proxy (Vercel/Heroku)
});

// Function to update session timeout dynamically
const updateSessionTimeout = (req, customTimeout) => {
  const timeout = customTimeout || getSessionTimeout();
  if (req.session) {
    req.session.cookie.maxAge = timeout;
  }
};

// Function to extend session manually
const extendSession = (req, additionalTime = null) => {
  if (req.session) {
    const currentTimeout = getSessionTimeout();
    const extensionTime = additionalTime || currentTimeout;
    req.session.cookie.maxAge = extensionTime;
    req.session.touch(); // Mark session as active
  }
};

module.exports = {
  sessionStore,
  sessionConfig,
  updateSessionTimeout,
  extendSession,
  getSessionTimeout
};
