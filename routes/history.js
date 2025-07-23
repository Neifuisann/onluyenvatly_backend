const express = require('express');
const router = express.Router();
const historyController = require('../lib/controllers/historyController');
const { requireAdminAuth } = require('../lib/middleware/auth');
const { noCacheMiddleware } = require('../lib/middleware/cache');

// All history routes require admin authentication and no caching
router.use(requireAdminAuth);
router.use(noCacheMiddleware);

// Get history with pagination and search
router.get('/', historyController.getHistory);

// Delete specific result
router.delete('/results/:resultId', historyController.deleteResult);

// Get lesson results
router.get('/lessons/:lessonId/results', historyController.getLessonResults);

module.exports = router;
