const express = require('express');
const router = express.Router();

// Import controllers
const ratingController = require('../lib/controllers/ratingController');

// Import middleware
const { 
  validateIdParam,
  validatePagination 
} = require('../lib/middleware/validation');
const { 
  requireAdminAuth,
  requireAdminOrOwner,
  optionalAuth 
} = require('../lib/middleware/auth');
const { 
  shortCacheMiddleware,
  noCacheMiddleware 
} = require('../lib/middleware/cache');

// Public rating routes
// General ratings endpoint with pagination and filtering
router.get('/',
  optionalAuth,
  validatePagination,
  shortCacheMiddleware(300), // 5 minutes cache
  ratingController.getRatings
);

router.get('/leaderboard',
  optionalAuth,
  validatePagination,
  shortCacheMiddleware(300), // 5 minutes cache
  ratingController.getLeaderboard
);

router.get('/statistics',
  optionalAuth,
  shortCacheMiddleware(600), // 10 minutes cache
  ratingController.getRatingStatistics
);

router.get('/tiers',
  optionalAuth,
  shortCacheMiddleware(3600), // 1 hour cache (static data)
  ratingController.getAllRatingTiers
);

router.get('/tier',
  optionalAuth,
  shortCacheMiddleware(3600), // 1 hour cache
  ratingController.getRatingTier
);

router.get('/distribution',
  optionalAuth,
  shortCacheMiddleware(600), // 10 minutes cache
  ratingController.getRatingDistribution
);

router.get('/top-performers',
  optionalAuth,
  validatePagination,
  shortCacheMiddleware(300), // 5 minutes cache
  ratingController.getTopPerformers
);

// Student-specific rating routes (admin or owner access)
router.get('/student/:studentId',
  requireAdminOrOwner,
  validateIdParam('studentId'),
  shortCacheMiddleware(300), // 5 minutes cache
  ratingController.getStudentRating
);

router.get('/student/:studentId/history',
  requireAdminOrOwner,
  validateIdParam('studentId'),
  validatePagination,
  shortCacheMiddleware(300), // 5 minutes cache
  ratingController.getStudentRatingHistory
);

// Rating management routes (admin only)
router.post('/update',
  requireAdminAuth,
  noCacheMiddleware,
  ratingController.updateStudentRating
);

router.post('/student/:studentId/reset',
  requireAdminAuth,
  validateIdParam('studentId'),
  noCacheMiddleware,
  ratingController.resetStudentRating
);

// Utility routes
router.post('/calculate-metrics',
  optionalAuth,
  noCacheMiddleware,
  ratingController.calculatePerformanceMetrics
);

router.post('/simulate',
  optionalAuth,
  noCacheMiddleware,
  ratingController.simulateRatingChange
);

module.exports = router;
