const express = require('express');
const router = express.Router();
const questService = require('../lib/services/questService');
const { requireStudentAuth, requireAdminAuth } = require('../lib/middleware/auth');

/**
 * @route GET /api/quests/daily
 * @desc Get today's daily quests
 * @access Public
 */
router.get('/daily', async (req, res) => {
  try {
    const today = new Date();
    const quests = await questService.generateDailyQuests(today);
    
    res.json({
      success: true,
      data: {
        date: today.toISOString().split('T')[0],
        quests
      }
    });
  } catch (error) {
    console.error('Error getting daily quests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily quests'
    });
  }
});

/**
 * @route GET /api/quests/daily/:date
 * @desc Get daily quests for specific date
 * @access Public
 */
router.get('/daily/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    const questDate = new Date(date);
    const quests = await questService.getDailyQuests(questDate);
    
    res.json({
      success: true,
      data: {
        date,
        quests
      }
    });
  } catch (error) {
    console.error('Error getting daily quests for date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily quests for specified date'
    });
  }
});

/**
 * @route GET /api/quests/progress
 * @desc Get quest progress for authenticated student
 * @access Private (Student)
 */
router.get('/progress', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { date } = req.query;
    
    const questDate = date ? new Date(date) : new Date();
    const progress = await questService.getStudentQuestProgress(studentId, questDate);
    
    res.json({
      success: true,
      data: {
        date: questDate.toISOString().split('T')[0],
        progress
      }
    });
  } catch (error) {
    console.error('Error getting quest progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get quest progress'
    });
  }
});

/**
 * @route POST /api/quests/progress/:questId
 * @desc Update progress on a specific quest
 * @access Private (Student)
 */
router.post('/progress/:questId', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { questId } = req.params;
    const { progressIncrement = 1, metadata = {} } = req.body;
    
    if (!questId || isNaN(questId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quest ID'
      });
    }
    
    const updatedProgress = await questService.updateQuestProgress(
      studentId,
      parseInt(questId),
      progressIncrement,
      metadata
    );
    
    if (!updatedProgress) {
      return res.status(404).json({
        success: false,
        message: 'Quest not found or progress could not be updated'
      });
    }
    
    res.json({
      success: true,
      data: updatedProgress,
      message: updatedProgress.completed 
        ? 'Quest completed! Rewards have been awarded.'
        : 'Progress updated successfully'
    });
  } catch (error) {
    console.error('Error updating quest progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quest progress'
    });
  }
});

/**
 * @route POST /api/quests/check
 * @desc Check and update quest progress based on activity
 * @access Private (Student)
 */
router.post('/check', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { activityType, activityData = {} } = req.body;
    
    if (!activityType) {
      return res.status(400).json({
        success: false,
        message: 'Activity type is required'
      });
    }
    
    const updatedQuests = await questService.checkAndUpdateQuests(
      studentId,
      activityType,
      activityData
    );
    
    const completedQuests = updatedQuests.filter(q => q.completed);
    
    res.json({
      success: true,
      data: {
        updatedQuests,
        completedCount: completedQuests.length
      },
      message: completedQuests.length > 0
        ? `Completed ${completedQuests.length} quest${completedQuests.length > 1 ? 's' : ''}!`
        : 'Quest progress updated'
    });
  } catch (error) {
    console.error('Error checking quest progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check quest progress'
    });
  }
});

/**
 * @route GET /api/quests/student/:studentId/progress
 * @desc Get quest progress for specific student (admin only)
 * @access Private (Admin)
 */
router.get('/student/:studentId/progress', requireAdminAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { date } = req.query;
    
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID'
      });
    }
    
    const questDate = date ? new Date(date) : new Date();
    const progress = await questService.getStudentQuestProgress(parseInt(studentId), questDate);
    
    res.json({
      success: true,
      data: {
        studentId: parseInt(studentId),
        date: questDate.toISOString().split('T')[0],
        progress
      }
    });
  } catch (error) {
    console.error('Error getting student quest progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get student quest progress'
    });
  }
});

/**
 * @route GET /api/quests/statistics
 * @desc Get quest completion statistics
 * @access Private (Admin)
 */
router.get('/statistics', requireAdminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const statistics = await questService.getQuestStatistics(start, end);
    
    res.json({
      success: true,
      data: {
        period: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        },
        statistics
      }
    });
  } catch (error) {
    console.error('Error getting quest statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get quest statistics'
    });
  }
});

/**
 * @route POST /api/quests/generate
 * @desc Generate daily quests for a specific date (admin only)
 * @access Private (Admin)
 */
router.post('/generate', requireAdminAuth, async (req, res) => {
  try {
    const { date } = req.body;
    
    const questDate = date ? new Date(date) : new Date();
    const quests = await questService.generateDailyQuests(questDate);
    
    res.json({
      success: true,
      data: {
        date: questDate.toISOString().split('T')[0],
        quests,
        count: quests.length
      },
      message: `Generated ${quests.length} daily quests`
    });
  } catch (error) {
    console.error('Error generating daily quests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate daily quests'
    });
  }
});

/**
 * @route GET /api/quests/templates
 * @desc Get available quest templates
 * @access Private (Admin)
 */
router.get('/templates', requireAdminAuth, (req, res) => {
  try {
    const templates = questService.getQuestTemplates();
    
    // Group templates by type
    const templatesByType = {};
    templates.forEach(template => {
      if (!templatesByType[template.type]) {
        templatesByType[template.type] = [];
      }
      templatesByType[template.type].push(template);
    });
    
    res.json({
      success: true,
      data: {
        templates,
        templatesByType,
        totalTemplates: templates.length
      }
    });
  } catch (error) {
    console.error('Error getting quest templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get quest templates'
    });
  }
});

/**
 * @route GET /api/quests/leaderboard
 * @desc Get quest completion leaderboard
 * @access Public
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = 'week', limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
        startDate = new Date('2020-01-01');
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    // Get quest completion data
    const { data: leaderboardData, error } = await require('../lib/config/database').supabase
      .from('student_quest_progress')
      .select(`
        student_id,
        completed,
        students (full_name),
        daily_quests (xp_reward)
      `)
      .eq('completed', true)
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', now.toISOString());
    
    if (error) throw error;
    
    // Group by student and calculate stats
    const studentStats = {};
    leaderboardData?.forEach(quest => {
      const studentId = quest.student_id;
      if (!studentStats[studentId]) {
        studentStats[studentId] = {
          studentId,
          studentName: quest.students?.full_name || 'Unknown Student',
          questsCompleted: 0,
          totalXPFromQuests: 0
        };
      }
      
      studentStats[studentId].questsCompleted++;
      studentStats[studentId].totalXPFromQuests += quest.daily_quests?.xp_reward || 0;
    });
    
    // Sort by quests completed, then by XP
    const leaderboard = Object.values(studentStats)
      .sort((a, b) => {
        if (a.questsCompleted !== b.questsCompleted) {
          return b.questsCompleted - a.questsCompleted;
        }
        return b.totalXPFromQuests - a.totalXPFromQuests;
      })
      .slice(0, limitNum)
      .map((entry, index) => ({
        rank: index + 1,
        ...entry
      }));
    
    res.json({
      success: true,
      data: {
        period,
        leaderboard,
        periodStart: startDate.toISOString().split('T')[0],
        periodEnd: now.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Error getting quest leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get quest leaderboard'
    });
  }
});

module.exports = router;