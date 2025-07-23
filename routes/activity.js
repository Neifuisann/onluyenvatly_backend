const express = require('express');
const router = express.Router();
const activityService = require('../lib/services/activityService');
const { asyncHandler } = require('../lib/middleware/errorHandler');
const { requireStudentAuth, requireAdminAuth } = require('../lib/middleware/auth');

/**
 * @route GET /api/activity/feed
 * @desc Get public activity feed
 * @access Public
 */
router.get('/feed', asyncHandler(async (req, res) => {
  const { 
    limit = 20, 
    offset = 0, 
    types 
  } = req.query;

  const activityTypes = types ? types.split(',') : [];
  const activities = await activityService.getPublicActivityFeed(
    parseInt(limit), 
    parseInt(offset), 
    activityTypes
  );

  res.json({
    success: true,
    data: {
      activities,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: activities.length === parseInt(limit)
      }
    }
  });
}));

/**
 * @route GET /api/activity/trending
 * @desc Get trending activities
 * @access Public
 */
router.get('/trending', asyncHandler(async (req, res) => {
  const { limit = 10, hours = 24 } = req.query;
  
  const activities = await activityService.getTrendingActivities(
    parseInt(limit), 
    parseInt(hours)
  );

  res.json({
    success: true,
    data: {
      activities,
      timeframe: `${hours} hours`
    }
  });
}));

/**
 * @route GET /api/activity/leaderboard
 * @desc Get leaderboard activities (top performers)
 * @access Public
 */
router.get('/leaderboard', asyncHandler(async (req, res) => {
  const { limit = 5 } = req.query;
  
  const activities = await activityService.getLeaderboardActivities(parseInt(limit));

  res.json({
    success: true,
    data: {
      activities,
      description: 'Recent top performers'
    }
  });
}));

/**
 * @route GET /api/activity/my-feed
 * @desc Get student's personal activity feed
 * @access Private (Student)
 */
router.get('/my-feed', requireStudentAuth, asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const studentId = req.session.studentId;

  const activities = await activityService.getStudentActivityFeed(
    studentId,
    parseInt(limit),
    parseInt(offset)
  );

  res.json({
    success: true,
    data: {
      activities,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: activities.length === parseInt(limit)
      }
    }
  });
}));

/**
 * @route POST /api/activity/create
 * @desc Create a custom activity (for admin use)
 * @access Private (Admin)
 */
router.post('/create', requireAdminAuth, asyncHandler(async (req, res) => {
  const {
    studentId,
    activityType,
    title,
    description = '',
    metadata = {},
    isPublic = true
  } = req.body;

  if (!studentId || !activityType || !title) {
    return res.status(400).json({
      success: false,
      message: 'Student ID, activity type, and title are required'
    });
  }

  const activity = await activityService.createActivity(
    studentId,
    activityType,
    title,
    description,
    metadata,
    isPublic
  );

  res.status(201).json({
    success: true,
    data: { activity },
    message: 'Activity created successfully'
  });
}));

/**
 * @route GET /api/activity/stats
 * @desc Get activity statistics
 * @access Private (Admin)
 */
router.get('/stats', requireAdminAuth, asyncHandler(async (req, res) => {
  const { 
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate = new Date() 
  } = req.query;

  const stats = await activityService.getActivityStatistics(
    new Date(startDate),
    new Date(endDate)
  );

  res.json({
    success: true,
    data: {
      stats,
      period: {
        start: startDate,
        end: endDate
      }
    }
  });
}));

/**
 * @route POST /api/activity/cleanup
 * @desc Clean up old activities
 * @access Private (Admin)
 */
router.post('/cleanup', requireAdminAuth, asyncHandler(async (req, res) => {
  const { daysToKeep = 90 } = req.body;

  const deletedCount = await activityService.cleanupOldActivities(parseInt(daysToKeep));

  res.json({
    success: true,
    data: {
      deletedCount,
      daysToKeep: parseInt(daysToKeep)
    },
    message: `Cleaned up ${deletedCount} old activities`
  });
}));

/**
 * @route GET /api/activity/types
 * @desc Get available activity types
 * @access Public
 */
router.get('/types', asyncHandler(async (req, res) => {
  const activityTypes = [
    {
      type: 'lesson_completed',
      name: 'Lesson Completed',
      description: 'Student completed a physics lesson',
      icon: '📚'
    },
    {
      type: 'achievement_earned',
      name: 'Achievement Earned',
      description: 'Student earned an achievement badge',
      icon: '🏆'
    },
    {
      type: 'streak_milestone',
      name: 'Streak Milestone',
      description: 'Student reached a learning streak milestone',
      icon: '🔥'
    },
    {
      type: 'level_up',
      name: 'Level Up',
      description: 'Student advanced to a new XP level',
      icon: '⭐'
    },
    {
      type: 'quest_completed',
      name: 'Quest Completed',
      description: 'Student completed a daily quest',
      icon: '✅'
    },
    {
      type: 'perfect_score',
      name: 'Perfect Score',
      description: 'Student achieved 100% on a lesson',
      icon: '🌟'
    },
    {
      type: 'study_session',
      name: 'Study Session',
      description: 'Student completed a study session',
      icon: '📖'
    }
  ];

  res.json({
    success: true,
    data: { activityTypes }
  });
}));

module.exports = router;