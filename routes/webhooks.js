const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Import middleware
const { noCacheMiddleware } = require('../lib/middleware/cache');

// Apply no-cache middleware to all webhook routes
router.use(noCacheMiddleware);

/**
 * Supabase Webhook Handler
 * Handles webhooks from Supabase database triggers
 * These endpoints bypass CSRF protection as they come from external sources
 */

// Middleware to validate Supabase webhook signature (optional but recommended)
const validateSupabaseWebhook = (req, res, next) => {
  // You can add webhook signature validation here if needed
  // For now, we'll just log the webhook for debugging
  console.log('[Webhook] Supabase webhook received:', {
    method: req.method,
    path: req.path,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type']
    },
    body: req.body
  });
  
  next();
};

// Generic webhook handler for database events
router.post('/database/:event', validateSupabaseWebhook, (req, res) => {
  const { event } = req.params;
  const payload = req.body;
  
  console.log(`[Webhook] Database ${event} event:`, payload);
  
  // Handle different database events
  switch (event) {
    case 'insert':
      handleDatabaseInsert(payload);
      break;
    case 'update':
      handleDatabaseUpdate(payload);
      break;
    case 'delete':
      handleDatabaseDelete(payload);
      break;
    default:
      console.log(`[Webhook] Unknown database event: ${event}`);
  }
  
  // Always respond with success to prevent webhook retries
  res.status(200).json({
    success: true,
    message: 'Webhook processed successfully',
    event: event,
    timestamp: new Date().toISOString()
  });
});

// Specific handlers for different table events
router.post('/students/:action', validateSupabaseWebhook, (req, res) => {
  const { action } = req.params;
  const payload = req.body;
  
  console.log(`[Webhook] Student ${action} webhook:`, payload);
  
  // Handle student-related webhooks
  switch (action) {
    case 'created':
      handleStudentCreated(payload);
      break;
    case 'updated':
      handleStudentUpdated(payload);
      break;
    case 'approved':
      handleStudentApproved(payload);
      break;
    default:
      console.log(`[Webhook] Unknown student action: ${action}`);
  }
  
  res.status(200).json({
    success: true,
    message: 'Student webhook processed',
    action: action
  });
});

router.post('/lessons/:action', validateSupabaseWebhook, (req, res) => {
  const { action } = req.params;
  const payload = req.body;
  
  console.log(`[Webhook] Lesson ${action} webhook:`, payload);
  
  // Handle lesson-related webhooks
  switch (action) {
    case 'created':
      handleLessonCreated(payload);
      break;
    case 'updated':
      handleLessonUpdated(payload);
      break;
    default:
      console.log(`[Webhook] Unknown lesson action: ${action}`);
  }
  
  res.status(200).json({
    success: true,
    message: 'Lesson webhook processed',
    action: action
  });
});

// Health check endpoint for webhook monitoring
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook service is healthy',
    timestamp: new Date().toISOString(),
    service: 'supabase-webhooks'
  });
});

// Webhook event handlers
function handleDatabaseInsert(payload) {
  // Handle database insert events
  console.log('[Handler] Processing database insert:', payload?.table);
}

function handleDatabaseUpdate(payload) {
  // Handle database update events
  console.log('[Handler] Processing database update:', payload?.table);
}

function handleDatabaseDelete(payload) {
  // Handle database delete events
  console.log('[Handler] Processing database delete:', payload?.table);
}

function handleStudentCreated(payload) {
  // Handle new student creation
  console.log('[Handler] New student created:', payload?.record?.id);
}

function handleStudentUpdated(payload) {
  // Handle student updates
  console.log('[Handler] Student updated:', payload?.record?.id);
}

function handleStudentApproved(payload) {
  // Handle student approval
  console.log('[Handler] Student approved:', payload?.record?.id);
}

function handleLessonCreated(payload) {
  // Handle new lesson creation
  console.log('[Handler] New lesson created:', payload?.record?.id);
}

function handleLessonUpdated(payload) {
  // Handle lesson updates
  console.log('[Handler] Lesson updated:', payload?.record?.id);
}

module.exports = router;
