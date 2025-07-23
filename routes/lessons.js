const express = require('express');
const router = express.Router();

// Import controllers
const lessonController = require('../lib/controllers/lessonController');

// Import services
const databaseService = require('../lib/services/databaseService');

// Import middleware
const {
  validateIdParam,
  validatePagination,
  validateSearch,
  validateLesson
} = require('../lib/middleware/validation');
const {
  requireAdminAuth,
  requireStudentAuth,
  optionalAuth
} = require('../lib/middleware/auth');
const {
  lessonCacheMiddleware,
  statisticsCacheMiddleware,
  noCacheMiddleware,
  shortCacheMiddleware
} = require('../lib/middleware/cache');
const { lessonEncryptionMiddleware } = require('../lib/middleware/encryption');

// Public lesson routes (with optional authentication)
router.get('/',
  optionalAuth,
  validatePagination,
  validateSearch,
  lessonCacheMiddleware,
  lessonController.getAllLessons
);

router.get('/search',
  optionalAuth,
  validatePagination,
  validateSearch,
  lessonCacheMiddleware,
  lessonController.searchLessons
);

router.get('/featured',
  optionalAuth,
  validatePagination,
  lessonCacheMiddleware,
  lessonController.getFeaturedLessons
);

router.get('/recent',
  optionalAuth,
  validatePagination,
  lessonCacheMiddleware,
  lessonController.getRecentLessons
);

router.get('/subject/:subject',
  optionalAuth,
  validatePagination,
  lessonCacheMiddleware,
  lessonController.getLessonsBySubject
);

router.get('/grade/:grade',
  optionalAuth,
  validatePagination,
  lessonCacheMiddleware,
  lessonController.getLessonsByGrade
);

// Get lessons filtered by tags
router.get('/tags/:tags',
  optionalAuth,
  validatePagination,
  lessonCacheMiddleware,
  lessonController.getLessonsByTags
);

// Get last incomplete lesson for the authenticated student
router.get('/last-incomplete',
  requireStudentAuth,
  noCacheMiddleware,
  lessonController.getLastIncompleteLesson
);

// Platform statistics for lessons page (must be before /:id route)
router.get('/platform-stats',
  optionalAuth,
  shortCacheMiddleware(600), // 10 minutes cache
  lessonController.getPlatformStats
);

// Admin route for lessons without images (must be before /:id route)
router.get('/without-images',
  requireAdminAuth,
  noCacheMiddleware,
  async (req, res) => {
    try {
      const dryRun = req.query['dry-run'] === 'true';

      if (dryRun) {
        // Just return the count
        const lessons = await databaseService.getLessonsWithoutImages(100);
        res.json({
          success: true,
          count: lessons ? lessons.length : 0
        });
      } else {
        // Return the actual lessons
        const limit = parseInt(req.query.limit) || 10;
        const lessons = await databaseService.getLessonsWithoutImages(limit);
        res.json({
          success: true,
          lessons: lessons || []
        });
      }
    } catch (error) {
      console.error('Error getting lessons without images:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get lessons without images',
        count: 0,
        lessons: []
      });
    }
  }
);

// Get lesson by ID - ENCRYPTED (contains quiz questions)
router.get('/:id',
  optionalAuth,
  validateIdParam('id'),
  lessonCacheMiddleware,
  lessonEncryptionMiddleware,
  lessonController.getLessonById
);

// Admin-only lesson management routes
router.post('/',
  requireAdminAuth,
  validateLesson,
  noCacheMiddleware,
  lessonController.createLesson
);

router.put('/:id',
  requireAdminAuth,
  validateIdParam('id'),
  validateLesson,
  noCacheMiddleware,
  lessonController.updateLesson
);

router.delete('/:id',
  requireAdminAuth,
  validateIdParam('id'),
  noCacheMiddleware,
  lessonController.deleteLesson
);

router.post('/reorder',
  requireAdminAuth,
  noCacheMiddleware,
  lessonController.updateLessonOrder
);

router.post('/:id/duplicate',
  requireAdminAuth,
  validateIdParam('id'),
  noCacheMiddleware,
  lessonController.duplicateLesson
);

// Lesson statistics and results (admin only)
router.get('/:id/statistics',
  requireAdminAuth,
  validateIdParam('id'),
  statisticsCacheMiddleware,
  lessonController.getLessonStatistics
);

router.get('/:id/results',
  requireAdminAuth,
  validateIdParam('id'),
  validatePagination,
  shortCacheMiddleware(300), // 5 minutes cache
  lessonController.getLessonResults
);

// Student-accessible ranking data
router.get('/:id/rankings',
  optionalAuth,
  validateIdParam('id'),
  shortCacheMiddleware(300), // 5 minutes cache
  lessonController.getStudentRankings
);

// AI Generation routes (admin only)
router.post('/generate-summary',
  requireAdminAuth,
  noCacheMiddleware,
  lessonController.generateLessonSummary
);

router.post('/generate-image',
  requireAdminAuth,
  noCacheMiddleware,
  lessonController.generateLessonImage
);

router.post('/:id/generate-image',
  requireAdminAuth,
  validateIdParam('id'),
  noCacheMiddleware,
  lessonController.generateLessonImage
);

router.post('/generate-image-variations',
  requireAdminAuth,
  noCacheMiddleware,
  lessonController.generateImageVariations
);

router.post('/bulk-generate-summaries',
  requireAdminAuth,
  noCacheMiddleware,
  lessonController.bulkGenerateAiSummaries
);

module.exports = router;
