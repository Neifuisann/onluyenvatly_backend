const express = require('express');
const router = express.Router();
const explainController = require('../lib/controllers/explainController');
const { requireStudentAuth } = require('../lib/middleware/auth');
const { noCacheMiddleware } = require('../lib/middleware/cache');
const { aiRateLimit } = require('../lib/middleware/rateLimiting');
const { resultEncryptionMiddleware } = require('../lib/middleware/encryption');

// Debug middleware to log incoming explain requests
router.use((req, res, next) => {
    console.log('[Explain Route Debug] Incoming request:', {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        headers: {
            'content-type': req.headers['content-type'],
            'x-csrf-token': req.headers['x-csrf-token'],
            'cookie': req.headers.cookie ? 'present' : 'missing'
        },
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        sessionId: req.session?.id,
        isAuthenticated: !!req.session?.studentId
    });
    next();
});

// AI explanation endpoint - ENCRYPTED
router.post('/',
    requireStudentAuth,
    noCacheMiddleware,
    aiRateLimit,
    resultEncryptionMiddleware,
    explainController.explainAnswer
);

module.exports = router;
