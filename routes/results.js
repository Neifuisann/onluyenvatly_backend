const express = require('express');
const router = express.Router();

// Import controller
const resultController = require('../lib/controllers/resultController');

// Import middleware
const {
  validateIdParam,
  validateResult,
  validatePagination
} = require('../lib/middleware/validation');
const {
  requireStudentAuth,
  requireAdminAuth,
  requireAdminOrOwner
} = require('../lib/middleware/auth');
const {
  resultsCacheMiddleware,
  noCacheMiddleware,
  shortCacheMiddleware
} = require('../lib/middleware/cache');
const { resultEncryptionMiddleware } = require('../lib/middleware/encryption');

// Submit lesson result - ENCRYPTED
router.post('/',
  requireStudentAuth,
  // Decrypt first, then validate the decrypted data
  resultEncryptionMiddleware,
  validateResult,
  noCacheMiddleware,
  resultController.submitResult
);

// Get result by ID
router.get('/:id',
  resultController.requireResultAccess,
  validateIdParam('id'),
  resultsCacheMiddleware,
  resultController.getResultById
);

// Delete result (admin only)
router.delete('/:id',
  requireAdminAuth,
  validateIdParam('id'),
  noCacheMiddleware,
  resultController.deleteResult
);

// Get all results (admin only)
router.get('/',
  requireAdminAuth,
  validatePagination,
  shortCacheMiddleware(300), // 5 minutes cache
  resultController.getAllResults
);

// Get results by lesson (admin only)
router.get('/lesson/:lessonId',
  requireAdminAuth,
  validateIdParam('lessonId'),
  validatePagination,
  shortCacheMiddleware(300), // 5 minutes cache
  resultController.getResultsByLesson
);

// Get results by student (admin or owner access)
router.get('/student/:studentId',
  requireAdminOrOwner,
  validateIdParam('studentId'),
  validatePagination,
  shortCacheMiddleware(300), // 5 minutes cache
  resultController.getResultsByStudent
);

// Get result statistics
router.get('/statistics/overview',
  requireAdminAuth,
  shortCacheMiddleware(600), // 10 minutes cache
  resultController.getResultStatistics
);

module.exports = router;
