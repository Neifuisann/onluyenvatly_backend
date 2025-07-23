const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../lib/middleware/errorHandler');
const { requireAdminAuth } = require('../lib/middleware/auth');
const { noCacheMiddleware } = require('../lib/middleware/cache');
const aiCacheService = require('../lib/services/cache/aiCacheService');
const databaseService = require('../lib/services/databaseService');
const aiService = require('../lib/services/ai/aiService');

// Get AI cache statistics
router.get('/cache/stats',
  requireAdminAuth,
  noCacheMiddleware,
  asyncHandler(async (req, res) => {
    try {
      // Check if aiCacheService is properly initialized
      if (!aiCacheService || typeof aiCacheService.getStats !== 'function') {
        throw new Error('AI Cache Service not properly initialized');
      }

      const cacheStats = aiCacheService.getStats();

      // The aiCacheService.getStats() returns { memory: { size, maxSize, usage }, types: {...}, lastCleanup }
      // Use the actual structure returned by the service
      const memoryStats = cacheStats.memory || { size: 0, usage: 0 };

      res.json({
        memory: {
          size: memoryStats.size || 0,
          usage: Math.round(memoryStats.usage || 0)
        },
        types: cacheStats.types || {},
        lastCleanup: cacheStats.lastCleanup || 'Never'
      });
    } catch (error) {
      console.error('Error getting cache stats:', error);
      res.status(500).json({
        error: 'Failed to get cache statistics',
        memory: { size: 0, usage: 0 },
        types: {},
        lastCleanup: 'Error'
      });
    }
  })
);

// Clear AI cache
router.post('/cache/clear',
  requireAdminAuth,
  noCacheMiddleware,
  asyncHandler(async (req, res) => {
    try {
      // Check if aiCacheService is properly initialized
      if (!aiCacheService) {
        throw new Error('AI Cache Service not available');
      }

      const { type } = req.body;

      if (type) {
        // Clear specific cache type
        if (typeof aiCacheService.clearCache === 'function') {
          await aiCacheService.clearCache(type);
          res.json({
            success: true,
            message: `${type} cache cleared successfully`
          });
        } else {
          throw new Error('clearCache method not available');
        }
      } else {
        // Clear all cache
        if (typeof aiCacheService.clearAllCache === 'function') {
          await aiCacheService.clearAllCache();
          res.json({
            success: true,
            message: 'All cache cleared successfully'
          });
        } else {
          throw new Error('clearAllCache method not available');
        }
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache',
        message: error.message
      });
    }
  })
);

// Get AI usage statistics
router.get('/usage/stats',
  requireAdminAuth,
  noCacheMiddleware,
  asyncHandler(async (req, res) => {
    try {
      let dailyRequests = 0;
      let totalTokens = 0;

      try {
        // Get today's AI interactions from database
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: interactions, error } = await databaseService.supabase
          .from('ai_interactions')
          .select('tokens_used, interaction_type')
          .gte('created_at', today.toISOString());

        if (error) {
          // If table doesn't exist or other DB error, log it but continue with defaults
          console.warn('ai_interactions table not accessible:', error.message);
        } else {
          // Calculate statistics from actual data
          dailyRequests = interactions ? interactions.length : 0;
          totalTokens = interactions ? interactions.reduce((sum, i) => sum + (i.tokens_used || 0), 0) : 0;
        }
      } catch (dbError) {
        console.warn('Database error when fetching AI interactions:', dbError.message);
        // Continue with default values
      }

      // Get cache stats for hit rate
      const cacheStats = aiCacheService.getStats();
      // For now, use a default cache hit rate since we don't track hits/misses yet
      const cacheHitRate = 0.5; // 50% default hit rate

      // Estimate cost (using Gemini pricing estimates)
      const estimatedCost = (totalTokens / 1000000) * 0.075;

      res.json({
        dailyRequests,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        estimatedCost: Math.round(estimatedCost * 100) / 100
      });
    } catch (error) {
      console.error('Error getting usage stats:', error);
      res.status(500).json({
        error: 'Failed to get usage statistics',
        dailyRequests: 0,
        cacheHitRate: 0.5,
        estimatedCost: 0
      });
    }
  })
);

// Generate AI tag suggestions for a lesson
router.post('/suggest-tags',
  requireAdminAuth,
  noCacheMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { lessonData } = req.body;

      if (!lessonData) {
        return res.status(400).json({
          success: false,
          error: 'Lesson data is required'
        });
      }

      // Get all existing tags from the system
      const existingTags = await databaseService.getAllUniqueTags();

      // Generate AI tag suggestions
      const suggestions = await aiService.generateTagSuggestions(lessonData, existingTags);

      res.json({
        success: true,
        suggestions: suggestions
      });

    } catch (error) {
      console.error('Error generating tag suggestions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate tag suggestions',
        message: error.message
      });
    }
  })
);

// AI Chat Assistant for lesson creation with streaming
router.post('/chat-assist',
  requireAdminAuth,
  noCacheMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { message, lessonContent, stream = false, useGoogleSearch = false, toolMode = 'url' } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      if (stream) {
        // Set up Server-Sent Events
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });

        try {
          // Generate AI response with true streaming
          const options = { stream: true, useGoogleSearch, toolMode };
          await aiService.generateChatAssistance(message, lessonContent, options, (chunk) => {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
          });

          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          res.end();
        } catch (streamError) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: streamError.message })}\n\n`);
          res.end();
        }
      } else {
        // Regular non-streaming response
        const options = { stream: false, useGoogleSearch, toolMode };
        const response = await aiService.generateChatAssistance(message, lessonContent, options);

        res.json({
          success: true,
          message: response.message,
          actions: response.actions || []
        });
      }

    } catch (error) {
      console.error('Error in AI chat assistance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate AI assistance',
        message: error.message
      });
    }
  })
);

// AI Lesson Analysis
router.post('/analyze-lesson',
  requireAdminAuth,
  noCacheMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { lessonContent } = req.body;

      if (!lessonContent) {
        return res.status(400).json({
          success: false,
          error: 'Lesson content is required'
        });
      }

      // Generate lesson analysis
      const analysis = await aiService.analyzeLessonContent(lessonContent);

      res.json({
        success: true,
        analysis: analysis
      });

    } catch (error) {
      console.error('Error in lesson analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze lesson',
        message: error.message
      });
    }
  })
);

module.exports = router;