const express = require('express');
const router = express.Router();
const debugController = require('../lib/controllers/debug-lesson');
const { requireAdminAuth } = require('../lib/middleware/auth');

// Debug endpoint for lesson inspection (admin only)
router.post('/lesson', requireAdminAuth, debugController.debugLesson);

module.exports = router;