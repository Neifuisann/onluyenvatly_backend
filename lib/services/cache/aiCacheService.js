const crypto = require('crypto');
const cacheService = require('../cacheService');

class AICacheService {
  constructor() {
    this.memoryCache = new Map();
    this.maxMemoryCacheSize = 1000; // Max items in memory
    this.defaultTTL = 3600; // 1 hour in seconds
    this.semanticThreshold = 0.85; // Similarity threshold for semantic caching
  }

  /**
   * Generate a cache key from AI request parameters
   * @param {string} type - Type of AI operation (summary, image, explanation)
   * @param {Object} params - Parameters for the AI request
   * @returns {string} - Cache key
   */
  generateCacheKey(type, params) {
    // Normalize and stringify parameters for consistent hashing
    const normalizedParams = this.normalizeParams(params);
    const paramsString = JSON.stringify(normalizedParams, Object.keys(normalizedParams).sort());
    
    // Create hash of type + parameters
    const hash = crypto.createHash('sha256')
      .update(`${type}:${paramsString}`)
      .digest('hex')
      .substring(0, 16);
    
    return `ai:${type}:${hash}`;
  }

  /**
   * Normalize parameters for consistent caching
   * @param {Object} params - Raw parameters
   * @returns {Object} - Normalized parameters
   */
  normalizeParams(params) {
    const normalized = { ...params };
    
    // Normalize text fields (trim, lowercase for comparison)
    if (normalized.title) {
      normalized.title = normalized.title.trim();
    }
    
    if (normalized.subject) {
      normalized.subject = normalized.subject.toLowerCase().trim();
    }
    
    if (normalized.grade) {
      normalized.grade = String(normalized.grade).trim();
    }
    
    // Sort arrays for consistent ordering
    if (normalized.tags && Array.isArray(normalized.tags)) {
      normalized.tags = normalized.tags.sort();
    }
    
    // For questions, normalize to just essential content for caching
    if (normalized.questions && Array.isArray(normalized.questions)) {
      normalized.questions = normalized.questions.map(q => ({
        question: q.question ? q.question.trim() : '',
        type: q.type || 'abcd'
      }));
    }
    
    return normalized;
  }

  /**
   * Get cached AI response
   * @param {string} type - Type of AI operation
   * @param {Object} params - Parameters for the AI request
   * @returns {Object|null} - Cached response or null
   */
  async get(type, params) {
    const cacheKey = this.generateCacheKey(type, params);
    
    // Try memory cache first
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey);
      if (cached.expiresAt > Date.now()) {
        return {
          ...cached.data,
          fromCache: true,
          cacheType: 'memory'
        };
      } else {
        this.memoryCache.delete(cacheKey);
      }
    }
    
    // Try persistent cache
    try {
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        // Store in memory cache for faster access
        this.setMemoryCache(cacheKey, cachedData, this.defaultTTL);
        return {
          ...cachedData,
          fromCache: true,
          cacheType: 'persistent'
        };
      }
    } catch (error) {
      console.error('Error reading from cache:', error);
    }
    
    // Try semantic similarity cache for text-based operations
    if (type === 'summary' || type === 'explanation') {
      const similarResult = await this.findSimilarCached(type, params);
      if (similarResult) {
        return {
          ...similarResult,
          fromCache: true,
          cacheType: 'semantic'
        };
      }
    }
    
    return null;
  }

  /**
   * Store AI response in cache
   * @param {string} type - Type of AI operation
   * @param {Object} params - Parameters for the AI request
   * @param {Object} response - AI response to cache
   * @param {number} ttl - Time to live in seconds
   */
  async set(type, params, response, ttl = null) {
    const cacheKey = this.generateCacheKey(type, params);
    const cacheTTL = ttl || this.defaultTTL;
    
    const cacheData = {
      ...response,
      timestamp: Date.now(),
      type: type,
      params: this.normalizeParams(params)
    };
    
    // Store in memory cache
    this.setMemoryCache(cacheKey, cacheData, cacheTTL);
    
    // Store in persistent cache
    try {
      await cacheService.set(cacheKey, cacheData, cacheTTL);
    } catch (error) {
      console.error('Error writing to cache:', error);
    }
    
    // Store metadata for semantic search
    if (type === 'summary' || type === 'explanation') {
      await this.storeSemanticMetadata(cacheKey, type, params, response);
    }
  }

  /**
   * Set item in memory cache with cleanup
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   * @param {number} ttl - Time to live in seconds
   */
  setMemoryCache(key, data, ttl) {
    // Clean up expired items if cache is getting full
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      this.cleanupMemoryCache();
    }
    
    const expiresAt = Date.now() + (ttl * 1000);
    this.memoryCache.set(key, {
      data: data,
      expiresAt: expiresAt
    });
  }

  /**
   * Clean up expired items from memory cache
   */
  cleanupMemoryCache() {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expiresAt <= now) {
        this.memoryCache.delete(key);
        removedCount++;
      }
    }
    
    // If still too full, remove oldest items
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      
      const toRemove = entries.slice(0, Math.floor(this.maxMemoryCacheSize * 0.2));
      toRemove.forEach(([key]) => this.memoryCache.delete(key));
      removedCount += toRemove.length;
    }
    
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} expired items from AI memory cache`);
    }
  }

  /**
   * Store semantic metadata for similarity search
   * @param {string} cacheKey - Cache key
   * @param {string} type - Operation type
   * @param {Object} params - Request parameters
   * @param {Object} response - AI response
   */
  async storeSemanticMetadata(cacheKey, type, params, response) {
    try {
      // Create a searchable text representation
      let searchableText = '';
      
      if (params.title) searchableText += params.title + ' ';
      if (params.subject) searchableText += params.subject + ' ';
      if (params.grade) searchableText += `khối ${params.grade} `;
      if (params.tags) searchableText += params.tags.join(' ') + ' ';
      
      if (params.questions && Array.isArray(params.questions)) {
        const questionTexts = params.questions
          .slice(0, 3) // Only first 3 questions for similarity
          .map(q => q.question || '')
          .join(' ');
        searchableText += questionTexts;
      }
      
      const metadata = {
        cacheKey: cacheKey,
        type: type,
        searchableText: searchableText.trim().toLowerCase(),
        responseLength: JSON.stringify(response).length,
        timestamp: Date.now()
      };
      
      await cacheService.set(`semantic:${cacheKey}`, metadata, this.defaultTTL * 2);
    } catch (error) {
      console.error('Error storing semantic metadata:', error);
    }
  }

  /**
   * Find similar cached responses using text similarity
   * @param {string} type - Operation type
   * @param {Object} params - Request parameters
   * @returns {Object|null} - Similar cached response or null
   */
  async findSimilarCached(type, params) {
    try {
      // This is a simplified similarity check
      // In production, you might want to use more sophisticated NLP techniques
      
      let currentText = '';
      if (params.title) currentText += params.title + ' ';
      if (params.subject) currentText += params.subject + ' ';
      if (params.grade) currentText += `khối ${params.grade} `;
      if (params.tags) currentText += params.tags.join(' ') + ' ';
      
      currentText = currentText.trim().toLowerCase();
      
      // Search through semantic metadata (simplified approach)
      // In a real implementation, you'd use a vector database or elasticsearch
      
      return null; // Placeholder - implement actual similarity search
    } catch (error) {
      console.error('Error in semantic similarity search:', error);
      return null;
    }
  }

  /**
   * Clear cache for specific type or all AI cache
   * @param {string} type - Optional type to clear (summary, image, explanation)
   */
  async clear(type = null) {
    if (type) {
      // Clear specific type from memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.includes(`:${type}:`)) {
          this.memoryCache.delete(key);
        }
      }
      
      // Clear from persistent cache (implementation depends on cache service)
      console.log(`Cleared AI cache for type: ${type}`);
    } else {
      // Clear all AI cache
      this.memoryCache.clear();
      console.log('Cleared all AI cache');
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    const memoryStats = {
      size: this.memoryCache.size,
      maxSize: this.maxMemoryCacheSize,
      usage: (this.memoryCache.size / this.maxMemoryCacheSize) * 100
    };
    
    // Count items by type
    const typeStats = {};
    for (const key of this.memoryCache.keys()) {
      const parts = key.split(':');
      if (parts.length >= 2) {
        const type = parts[1];
        typeStats[type] = (typeStats[type] || 0) + 1;
      }
    }
    
    return {
      memory: memoryStats,
      types: typeStats,
      lastCleanup: this.lastCleanup || 'Never'
    };
  }

  /**
   * Calculate cost savings from cache hits
   * @param {string} type - Operation type
   * @param {number} tokensAvoidedEstimate - Estimated tokens saved
   * @returns {Object} - Cost savings information
   */
  calculateCostSavings(type, tokensAvoidedEstimate) {
    // Rough cost estimates for Gemini API (as of 2024)
    const costPerToken = {
      'summary': 0.000015, // $0.000015 per token for input
      'image': 0.0002,     // Estimate for image generation
      'explanation': 0.000015
    };
    
    const cost = (costPerToken[type] || 0.000015) * tokensAvoidedEstimate;
    
    return {
      tokensAvoided: tokensAvoidedEstimate,
      estimatedCostSaved: cost,
      currency: 'USD'
    };
  }

  /**
   * Clear cache for a specific type
   * @param {string} type - Cache type to clear
   */
  async clearCache(type) {
    // Clear from memory cache
    const keysToDelete = [];
    for (const key of this.memoryCache.keys()) {
      if (key.includes(`:${type}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.memoryCache.delete(key));

    // Clear from persistent cache (if implemented)
    // For now, just reset stats for the type
    this.stats.hits = Math.max(0, this.stats.hits - keysToDelete.length);
    
    console.log(`Cleared ${keysToDelete.length} ${type} cache entries`);
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    // Clear memory cache
    const previousSize = this.memoryCache.size;
    this.memoryCache.clear();
    
    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      persistentHits: 0
    };
    
    this.lastCleanup = new Date();
    
    console.log(`Cleared all cache (${previousSize} entries)`);
  }
}

module.exports = new AICacheService();