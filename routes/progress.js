const express = require('express');
const router = express.Router();

// Import controllers
const progressController = require('../lib/controllers/progressController');

// Import middleware
const { 
  requireStudentAuth 
} = require('../lib/middleware/auth');
const { 
  shortCacheMiddleware, 
  noCacheMiddleware 
} = require('../lib/middleware/cache');

// All progress routes require student authentication
router.use(requireStudentAuth);

// Get student progress overview
router.get('/overview',
  shortCacheMiddleware(300), // 5 minutes cache
  progressController.getStudentProgress
);

// Get detailed progress by topic/chapter
router.get('/detailed',
  shortCacheMiddleware(300), // 5 minutes cache
  progressController.getDetailedProgress
);

// Get learning statistics
router.get('/stats',
  shortCacheMiddleware(600), // 10 minutes cache
  progressController.getLearningStats
);

// Get recommended lessons
router.get('/recommendations',
  shortCacheMiddleware(900), // 15 minutes cache
  progressController.getRecommendedLessons
);

// Get mistakes to review
router.get('/mistakes',
  shortCacheMiddleware(300), // 5 minutes cache
  progressController.getMistakesToReview
);

// Mark mistakes as reviewed
router.post('/mistakes/review',
  noCacheMiddleware,
  progressController.markMistakesReviewed
);

// Practice mode endpoints
router.post('/practice/questions',
  noCacheMiddleware,
  progressController.getPracticeQuestions
);

router.post('/practice/submit',
  noCacheMiddleware,
  progressController.submitPracticeResults
);

// Get student achievements
router.get('/achievements',
  shortCacheMiddleware(600), // 10 minutes cache
  progressController.getAchievements
);

// Update student streak (POST request)
router.post('/streak',
  noCacheMiddleware,
  progressController.updateStreak
);

// Mark lesson as completed
router.post('/lesson/:lessonId/complete',
  noCacheMiddleware,
  progressController.markLessonCompleted
);

module.exports = router;
