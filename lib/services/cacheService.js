const crypto = require('crypto');
const { CACHE_CONFIG } = require('../config/constants');

class CacheService {
  constructor() {
    this.aiCache = new Map();
  }

  // Generate ETag for data
  generateETag(data) {
    if (!data) {
      return null;
    }
    
    // Use JSON.stringify for consistent serialization of JS objects/arrays
    // Sort keys for objects to ensure consistent hashing regardless of key order
    const dataString = JSON.stringify(data, (key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce((sorted, key) => {
            sorted[key] = value[key];
            return sorted;
          }, {});
      }
      return value;
    });
    
    // Create a SHA1 hash - strong enough for ETag, reasonably fast
    return crypto.createHash('sha1').update(dataString).digest('hex');
  }

  // Set cache headers on response
  setCacheHeaders(res, etag, maxAgeSeconds = CACHE_CONFIG.DEFAULT_MAX_AGE) {
    if (etag) {
      // ETags should be quoted as per HTTP spec
      res.setHeader('ETag', `"${etag}"`);
    }
    
    // Cache-Control: public (allow proxies), max-age (duration), must-revalidate (check ETag before using stale cache)
    res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}, must-revalidate`);
    
    // Optionally add Last-Modified if you have a relevant timestamp for the data
    // res.setHeader('Last-Modified', new Date(data.lastUpdated).toUTCString());
  }

  // Check if request should be cached
  shouldCache(req) {
    const path = req.path || req.originalUrl || '';

    // Don't cache admin routes or authenticated routes that need fresh data
    if (!path.includes('/admin/') &&
        !path.includes('/api/admin/') &&
        !path.includes('/api/history') &&
        req.method === 'GET') {

      // Additional check: Don't cache requests from admin users
      // Check if user is authenticated as admin via session
      if (req.session && req.session.adminId) {
        console.log(`Cache disabled for admin user: ${req.session.adminId} on ${path}`);
        return false;
      }

      // Check for admin authentication via headers or other methods
      const sessionService = require('./sessionService');
      try {
        if (sessionService.isAdminAuthenticated(req)) {
          console.log(`Cache disabled for admin request on ${path}`);
          return false;
        }
      } catch (error) {
        // If session service fails, err on the side of caution and don't cache
        console.warn('Session service error in cache check:', error);
        return false;
      }

      return true;
    }

    return false;
  }

  // Check if client has valid cache
  checkClientCache(req, etag) {
    const clientETag = req.headers['if-none-match'];
    return clientETag && clientETag === `"${etag}"`;
  }

  // Handle cache response
  handleCacheResponse(req, res, data, cacheKey = null, maxAge = null) {
    if (!this.shouldCache(req)) {
      return { fromCache: false, data };
    }

    const etag = this.generateETag(data);
    const cacheMaxAge = maxAge || this.getCacheMaxAge(req.path);

    if (this.checkClientCache(req, etag)) {
      console.log(`Cache hit for ${req.path}`);
      res.status(304).send();
      return { fromCache: true, data: null };
    }

    console.log(`Cache miss for ${req.path}`);
    this.setCacheHeaders(res, etag, cacheMaxAge);
    return { fromCache: false, data };
  }

  // Get appropriate cache max age based on route
  getCacheMaxAge(path) {
    if (path.includes('/api/lessons/') && path.includes('/statistics')) {
      return CACHE_CONFIG.STATISTICS_CACHE_MAX_AGE;
    }
    
    if (path.includes('/api/lessons/')) {
      return CACHE_CONFIG.LESSON_CACHE_MAX_AGE;
    }
    
    if (path.includes('/api/results/')) {
      return CACHE_CONFIG.RESULTS_CACHE_MAX_AGE;
    }
    
    return CACHE_CONFIG.DEFAULT_MAX_AGE;
  }

  // Clear cache headers (for error responses)
  clearCacheHeaders(res) {
    res.removeHeader('ETag');
    res.removeHeader('Cache-Control');
    res.removeHeader('Last-Modified');
  }

  // Create cache key for complex data
  createCacheKey(prefix, ...parts) {
    const keyParts = [prefix, ...parts.map(part => 
      typeof part === 'object' ? JSON.stringify(part) : String(part)
    )];
    return keyParts.join(':');
  }

  // Validate cache configuration
  validateCacheConfig() {
    const errors = [];

    if (typeof CACHE_CONFIG.DEFAULT_MAX_AGE !== 'number' || CACHE_CONFIG.DEFAULT_MAX_AGE < 0) {
      errors.push('Invalid DEFAULT_MAX_AGE configuration');
    }

    if (typeof CACHE_CONFIG.LESSON_CACHE_MAX_AGE !== 'number' || CACHE_CONFIG.LESSON_CACHE_MAX_AGE < 0) {
      errors.push('Invalid LESSON_CACHE_MAX_AGE configuration');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get cache statistics (for monitoring)
  getCacheStats() {
    // This would be implemented with a proper cache store
    // For now, return basic info
    return {
      enabled: true,
      defaultMaxAge: CACHE_CONFIG.DEFAULT_MAX_AGE,
      lessonMaxAge: CACHE_CONFIG.LESSON_CACHE_MAX_AGE,
      statisticsMaxAge: CACHE_CONFIG.STATISTICS_CACHE_MAX_AGE,
      resultsMaxAge: CACHE_CONFIG.RESULTS_CACHE_MAX_AGE
    };
  }

  // Middleware for automatic cache handling
  cacheMiddleware() {
    return (req, res, next) => {
      // Store original res.json method
      const originalJson = res.json;
      
      // Override res.json to handle caching
      res.json = (data) => {
        const cacheResult = this.handleCacheResponse(req, res, data);
        
        if (cacheResult.fromCache) {
          return; // 304 response already sent
        }
        
        // Call original json method with data
        return originalJson.call(res, cacheResult.data);
      };
      
      next();
    };
  }

  // Cache warming utilities
  async warmCache(routes = []) {
    // This would be implemented to pre-populate cache for important routes
    console.log('Cache warming not implemented yet');
    return { warmed: 0, failed: 0 };
  }



  // Memory usage monitoring
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024) // MB
    };
  }

  // Simple in-memory cache for AI features (replace with Redis in production)

  async get(key) {
    const item = this.aiCache.get(key);
    if (!item) return null;
    
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.aiCache.delete(key);
      return null;
    }
    
    return item.data;
  }

  async set(key, value, ttl = 3600) {
    const expiresAt = ttl ? Date.now() + (ttl * 1000) : null;
    this.aiCache.set(key, { data: value, expiresAt });
  }
}

module.exports = new CacheService();
