const cacheService = require('../services/cacheService');

// Main cache middleware
const cacheMiddleware = cacheService.cacheMiddleware();

// Specific cache middleware for lessons
const lessonCacheMiddleware = (req, res, next) => {
  // Store original res.json method
  const originalJson = res.json;

  // Override res.json to handle lesson-specific caching
  res.json = (data) => {
    // Create cache key that includes query parameters for lesson lists
    let cacheKey = `lesson:${req.params.id || 'list'}`;
    if (!req.params.id) {
      // For lesson lists, include query parameters in cache key
      const { page, limit, search, sort, tags } = req.query;
      const queryKey = `${page || 1}:${limit || 10}:${search || ''}:${sort || 'newest'}:${tags || ''}`;
      cacheKey = `lesson:list:${queryKey}`;
    }

    const cacheResult = cacheService.handleCacheResponse(
      req,
      res,
      data,
      cacheKey,
      cacheService.getCacheMaxAge('/api/lessons/')
    );

    if (cacheResult.fromCache) {
      return; // 304 response already sent
    }

    // Call original json method with data
    return originalJson.call(res, cacheResult.data);
  };

  next();
};

// Cache middleware for statistics
const statisticsCacheMiddleware = (req, res, next) => {
  // Store original res.json method
  const originalJson = res.json;
  
  // Override res.json to handle statistics caching
  res.json = (data) => {
    const cacheResult = cacheService.handleCacheResponse(
      req, 
      res, 
      data, 
      `statistics:${req.path}`,
      cacheService.getCacheMaxAge('/api/lessons/statistics')
    );
    
    if (cacheResult.fromCache) {
      return; // 304 response already sent
    }
    
    // Call original json method with data
    return originalJson.call(res, cacheResult.data);
  };
  
  next();
};

// Cache middleware for results
const resultsCacheMiddleware = (req, res, next) => {
  // Store original res.json method
  const originalJson = res.json;
  
  // Override res.json to handle results caching
  res.json = (data) => {
    const cacheResult = cacheService.handleCacheResponse(
      req, 
      res, 
      data, 
      `results:${req.params.id || 'list'}`,
      cacheService.getCacheMaxAge('/api/results/')
    );
    
    if (cacheResult.fromCache) {
      return; // 304 response already sent
    }
    
    // Call original json method with data
    return originalJson.call(res, cacheResult.data);
  };
  
  next();
};

// No cache middleware (for dynamic content)
const noCacheMiddleware = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// Short cache middleware (for frequently changing content)
const shortCacheMiddleware = (maxAge = 60) => {
  return (req, res, next) => {
    // Store original res.json method
    const originalJson = res.json;
    
    // Override res.json to handle short caching
    res.json = (data) => {
      const etag = cacheService.generateETag(data);
      
      if (cacheService.checkClientCache(req, etag)) {
        res.status(304).send();
        return;
      }
      
      cacheService.setCacheHeaders(res, etag, maxAge);
      return originalJson.call(res, data);
    };
    
    next();
  };
};

// Long cache middleware (for static content)
const longCacheMiddleware = (maxAge = 3600) => {
  return (req, res, next) => {
    // Store original res.json method
    const originalJson = res.json;
    
    // Override res.json to handle long caching
    res.json = (data) => {
      const etag = cacheService.generateETag(data);
      
      if (cacheService.checkClientCache(req, etag)) {
        res.status(304).send();
        return;
      }
      
      cacheService.setCacheHeaders(res, etag, maxAge);
      return originalJson.call(res, data);
    };
    
    next();
  };
};

// Conditional cache middleware
const conditionalCacheMiddleware = (condition, maxAge) => {
  return (req, res, next) => {
    if (condition(req)) {
      return cacheMiddleware(req, res, next);
    }
    return noCacheMiddleware(req, res, next);
  };
};



// Cache warming middleware (for important routes)
const cacheWarmingMiddleware = (routes) => {
  return async (req, res, next) => {
    // Warm cache in background (don't block request)
    setImmediate(async () => {
      try {
        await cacheService.warmCache(routes);
      } catch (error) {
        console.error('Cache warming error:', error);
      }
    });
    
    next();
  };
};

// Cache monitoring middleware
const cacheMonitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Store original res.json method
  const originalJson = res.json;
  
  // Override res.json to log cache performance
  res.json = (data) => {
    const duration = Date.now() - startTime;
    const cacheStatus = res.getHeader('ETag') ? 'HIT' : 'MISS';
    
    console.log(`📊 Cache ${cacheStatus}: ${req.method} ${req.path} - ${duration}ms`);
    
    return originalJson.call(res, data);
  };
  
  next();
};

// Cache health check middleware
const cacheHealthMiddleware = (req, res, next) => {
  const cacheStats = cacheService.getCacheStats();
  const memoryUsage = cacheService.getMemoryUsage();

  // Add cache health info to response headers (for monitoring)
  res.setHeader('X-Cache-Enabled', cacheStats.enabled);
  res.setHeader('X-Memory-Usage', `${memoryUsage.heapUsed}MB`);

  next();
};



module.exports = {
  cacheMiddleware,
  lessonCacheMiddleware,
  statisticsCacheMiddleware,
  resultsCacheMiddleware,
  noCacheMiddleware,
  shortCacheMiddleware,
  longCacheMiddleware,
  conditionalCacheMiddleware,
  cacheWarmingMiddleware,
  cacheMonitoringMiddleware,
  cacheHealthMiddleware
};
