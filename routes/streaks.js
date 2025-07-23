const express = require('express');
const router = express.Router();
const streakService = require('../lib/services/streakService');
const { requireStudentAuth } = require('../lib/middleware/auth');

/**
 * @route GET /api/streaks/stats
 * @desc Get current streak statistics for authenticated student
 * @access Private (Student)
 */
router.get('/stats', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    const streakStats = await streakService.getStreakStats(studentId);
    
    res.json({
      success: true,
      data: streakStats
    });
  } catch (error) {
    console.error('Error getting streak stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get streak statistics'
    });
  }
});

/**
 * @route POST /api/streaks/activity
 * @desc Record daily activity and update streak
 * @access Private (Student)
 */
router.post('/activity', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    const result = await streakService.recordDailyActivity(studentId);
    
    res.json({
      success: true,
      data: result,
      message: `Daily activity recorded! Current streak: ${result.stats.currentStreak} days`
    });
  } catch (error) {
    console.error('Error recording daily activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record daily activity'
    });
  }
});

/**
 * @route POST /api/streaks/freeze
 * @desc Use a streak freeze to protect current streak
 * @access Private (Student)
 */
router.post('/freeze', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    
    // Check if student has freezes available
    const streakStats = await streakService.getStreakStats(studentId);
    
    if (!streakStats.canUseFreeze) {
      return res.status(400).json({
        success: false,
        message: 'Cannot use streak freeze at this time'
      });
    }
    
    const result = await streakService.useStreakFreeze(studentId);
    
    res.json({
      success: true,
      data: result,
      message: 'Streak freeze used successfully! Your streak is protected.'
    });
  } catch (error) {
    console.error('Error using streak freeze:', error);
    
    if (error.message === 'No streak freezes available') {
      return res.status(400).json({
        success: false,
        message: 'You have no streak freezes available'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to use streak freeze'
    });
  }
});

/**
 * @route GET /api/streaks/leaderboard
 * @desc Get streak leaderboard
 * @access Public
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = 'current', limit = 50 } = req.query;
    
    if (!['current', 'longest'].includes(period)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Must be "current" or "longest"'
      });
    }
    
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 entries
    const leaderboard = await streakService.getStreakLeaderboard(period, limitNum);
    
    res.json({
      success: true,
      data: {
        period,
        limit: limitNum,
        leaderboard
      }
    });
  } catch (error) {
    console.error('Error getting streak leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get streak leaderboard'
    });
  }
});

/**
 * @route GET /api/streaks/top-performers
 * @desc Get top streak performers
 * @access Public
 */
router.get('/top-performers', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 10, 50); // Max 50 entries
    
    const topPerformers = await streakService.getTopStreakPerformers(limitNum);
    
    res.json({
      success: true,
      data: {
        limit: limitNum,
        topPerformers
      }
    });
  } catch (error) {
    console.error('Error getting top streak performers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get top streak performers'
    });
  }
});

/**
 * @route GET /api/streaks/activity-history
 * @desc Get streak activity history for authenticated student
 * @access Private (Student)
 */
router.get('/activity-history', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { days = 30 } = req.query;
    const daysNum = Math.min(parseInt(days) || 30, 365); // Max 1 year
    
    const activityHistory = await streakService.getStreakActivityHistory(studentId, daysNum);
    
    res.json({
      success: true,
      data: {
        days: daysNum,
        history: activityHistory
      }
    });
  } catch (error) {
    console.error('Error getting activity history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get activity history'
    });
  }
});

/**
 * @route POST /api/streaks/reset-freezes
 * @desc Reset streak freezes for student (admin only)
 * @access Private (Admin)
 */
router.post('/reset-freezes', async (req, res) => {
  try {
    // Note: Add admin auth middleware when available
    const { studentId } = req.body;
    
    if (studentId) {
      await streakService.resetStreakFreezes(studentId);
      res.json({
        success: true,
        message: 'Streak freezes reset for student'
      });
    } else {
      await streakService.resetStreakFreezes();
      res.json({
        success: true,
        message: 'Streak freezes reset for all students'
      });
    }
  } catch (error) {
    console.error('Error resetting streak freezes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset streak freezes'
    });
  }
});

/**
 * @route GET /api/streaks/milestones
 * @desc Get streak milestones and rewards
 * @access Public
 */
router.get('/milestones', (req, res) => {
  try {
    const milestones = [
      {
        days: 3,
        title: 'Getting Started',
        description: 'Maintain a 3-day learning streak',
        xpReward: 100,
        badge: '🔥'
      },
      {
        days: 7,
        title: 'Week Warrior',
        description: 'Maintain a 7-day learning streak',
        xpReward: 200,
        badge: '⚡'
      },
      {
        days: 14,
        title: 'Two Week Champion',
        description: 'Maintain a 14-day learning streak',
        xpReward: 300,
        badge: '💪'
      },
      {
        days: 30,
        title: 'Monthly Master',
        description: 'Maintain a 30-day learning streak',
        xpReward: 500,
        badge: '🏆'
      },
      {
        days: 50,
        title: 'Persistent Learner',
        description: 'Maintain a 50-day learning streak',
        xpReward: 750,
        badge: '💎'
      },
      {
        days: 100,
        title: 'Century Scholar',
        description: 'Maintain a 100-day learning streak',
        xpReward: 1000,
        badge: '🌟'
      },
      {
        days: 365,
        title: 'Year-long Legend',
        description: 'Maintain a 365-day learning streak',
        xpReward: 2000,
        badge: '👑'
      }
    ];
    
    res.json({
      success: true,
      data: {
        milestones
      }
    });
  } catch (error) {
    console.error('Error getting streak milestones:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get streak milestones'
    });
  }
});

/**
 * @route GET /api/streaks/student/:studentId
 * @desc Get streak information for specific student (admin only)
 * @access Private (Admin)
 */
router.get('/student/:studentId', async (req, res) => {
  try {
    // Note: Add admin auth middleware when available
    const { studentId } = req.params;
    
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID'
      });
    }
    
    const streakStats = await streakService.getStreakStats(parseInt(studentId));
    
    res.json({
      success: true,
      data: streakStats
    });
  } catch (error) {
    console.error('Error getting student streak info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get student streak information'
    });
  }
});

module.exports = router;