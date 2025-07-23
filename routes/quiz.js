const express = require('express');
const router = express.Router();
const quizController = require('../lib/controllers/quizController');
const { requireStudentAuth, requireAdminAuth } = require('../lib/middleware/auth');
const { shortCacheMiddleware, noCacheMiddleware } = require('../lib/middleware/cache');
const { quizEncryptionMiddleware } = require('../lib/middleware/encryption');

// Get quiz data (student route) - ENCRYPTED
router.get('/',
    requireStudentAuth,
    shortCacheMiddleware(1800), // 30 minutes cache
    quizEncryptionMiddleware,
    quizController.getQuiz
);

// Submit quiz results (student route) - ENCRYPTED
router.post('/submit',
    requireStudentAuth,
    noCacheMiddleware,
    quizEncryptionMiddleware,
    quizController.submitQuiz
);

// Save quiz configuration (admin route)
router.post('/save',
    requireAdminAuth,
    noCacheMiddleware,
    quizController.saveQuiz
);

module.exports = router;
