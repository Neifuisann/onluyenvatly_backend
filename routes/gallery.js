const express = require('express');
const router = express.Router();
const galleryController = require('../lib/controllers/galleryController');
const { optionalAuth } = require('../lib/middleware/auth');
const { shortCacheMiddleware } = require('../lib/middleware/cache');

router.get('/', 
    optionalAuth,
    shortCacheMiddleware(600), // 10 minutes cache
    galleryController.getGalleryImages
);

module.exports = router;
