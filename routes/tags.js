const express = require('express');
const router = express.Router();
const tagsController = require('../lib/controllers/tagsController');
const { optionalAuth } = require('../lib/middleware/auth');
const { longCacheMiddleware, shortCacheMiddleware } = require('../lib/middleware/cache');

router.get('/',
    optionalAuth,
    longCacheMiddleware(3600), // 1 hour cache
    tagsController.getAllTags
);

router.get('/popular',
    optionalAuth,
    shortCacheMiddleware(600), // 10 minutes cache (shorter for dynamic popularity data)
    tagsController.getPopularTags
);

router.get('/related/:tag',
    optionalAuth,
    shortCacheMiddleware(300), // 5 minutes cache for related tags
    tagsController.getRelatedTags
);

router.get('/intersection',
    optionalAuth,
    shortCacheMiddleware(300), // 5 minutes cache for intersection tags
    tagsController.getIntersectionTags
);

router.get('/complete',
    optionalAuth,
    longCacheMiddleware(1800), // 30 minutes cache for complete tags data
    tagsController.getCompleteTags
);

module.exports = router;
