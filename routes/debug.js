const express = require('express');
const router = express.Router();
// const debugController = require('../lib/controllers/debug-lesson'); // DISABLED: Controller deleted
const { requireAdminAuth } = require('../lib/middleware/auth');

// Debug endpoint for lesson inspection (admin only)
// DISABLED: debug-lesson controller was removed
// router.post('/lesson', requireAdminAuth, debugController.debugLesson);

// Return 404 for all debug routes since functionality was removed
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Debug functionality has been disabled'
  });
});

module.exports = router;