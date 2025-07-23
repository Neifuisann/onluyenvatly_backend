const express = require('express');
const router = express.Router();
const multer = require('multer');

// Import controllers
const uploadController = require('../lib/controllers/uploadController');

// Import middleware
const { 
  validateFileUpload,
  validateIdParam 
} = require('../lib/middleware/validation');
const { 
  requireAdminAuth 
} = require('../lib/middleware/auth');
const { 
  noCacheMiddleware,
  shortCacheMiddleware 
} = require('../lib/middleware/cache');
const { uploadErrorHandler } = require('../lib/middleware/errorHandler');
const { uploadRateLimit } = require('../lib/middleware/rateLimiting');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // Maximum 10 files for bulk upload
  },
  fileFilter: (req, file, cb) => {
    // Allow images and documents
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Apply admin authentication to all upload routes
router.use(requireAdminAuth);
router.use(noCacheMiddleware);
router.use(uploadRateLimit);

// Image upload routes
router.post('/image',
  upload.single('image'),
  uploadErrorHandler,
  validateFileUpload,
  uploadController.uploadLessonImage
);

router.post('/images/bulk',
  upload.array('images', 10),
  uploadErrorHandler,
  validateFileUpload,
  uploadController.bulkUploadImages
);

router.delete('/image/:filename',
  validateIdParam('filename'),
  uploadController.deleteImage
);

// Document upload and processing routes
router.post('/document',
  upload.single('document'),
  uploadErrorHandler,
  validateFileUpload,
  uploadController.uploadDocument
);

// File validation route
router.post('/validate',
  upload.single('file'),
  uploadErrorHandler,
  uploadController.validateFile
);

// Configuration and utility routes
router.get('/config',
  shortCacheMiddleware(3600), // 1 hour cache
  uploadController.getUploadConfig
);

router.get('/storage/stats',
  shortCacheMiddleware(300), // 5 minutes cache
  uploadController.getStorageStats
);

// AI service testing route
router.post('/test-ai',
  uploadController.testAIService
);

module.exports = router;
