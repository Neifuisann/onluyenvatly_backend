const express = require('express');
const router = express.Router();
const xpService = require('../lib/services/xpService');
const { requireStudentAuth, requireAdminAuth } = require('../lib/middleware/auth');

/**
 * @route GET /api/xp/stats
 * @desc Get XP statistics for authenticated student
 * @access Private (Student)
 */
router.get('/stats', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    const xpStats = await xpService.getStudentXPStats(studentId);
    
    res.json({
      success: true,
      data: xpStats
    });
  } catch (error) {
    console.error('Error getting XP stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get XP statistics'
    });
  }
});

/**
 * @route GET /api/xp/leaderboard
 * @desc Get XP leaderboard
 * @access Public
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = 'all_time', limit = 50 } = req.query;
    
    if (!['all_time', 'monthly', 'weekly'].includes(period)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Must be "all_time", "monthly", or "weekly"'
      });
    }
    
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 entries
    const leaderboard = await xpService.getXPLeaderboard(period, limitNum);
    
    res.json({
      success: true,
      data: {
        period,
        limit: limitNum,
        leaderboard
      }
    });
  } catch (error) {
    console.error('Error getting XP leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get XP leaderboard'
    });
  }
});

/**
 * @route GET /api/xp/history
 * @desc Get XP transaction history for authenticated student
 * @access Private (Student)
 */
router.get('/history', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 200); // Max 200 entries
    
    const history = await xpService.getXPTransactionHistory(studentId, limitNum);
    
    res.json({
      success: true,
      data: {
        limit: limitNum,
        history
      }
    });
  } catch (error) {
    console.error('Error getting XP history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get XP transaction history'
    });
  }
});

/**
 * @route GET /api/xp/levels
 * @desc Get level information and requirements
 * @access Public
 */
router.get('/levels', (req, res) => {
  try {
    const levels = [];
    
    // Generate level information for first 25 levels
    for (let level = 1; level <= 25; level++) {
      const xpRequired = level === 1 ? 0 : xpService.getXPRequiredForLevel(level);
      const levelTitle = xpService.getLevelTitle(level);
      
      levels.push({
        level,
        xpRequired,
        title: levelTitle.title,
        description: levelTitle.description,
        icon: levelTitle.icon
      });
    }
    
    res.json({
      success: true,
      data: {
        levels
      }
    });
  } catch (error) {
    console.error('Error getting level information:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get level information'
    });
  }
});

/**
 * @route POST /api/xp/award
 * @desc Award XP to a student (admin only)
 * @access Private (Admin)
 */
router.post('/award', requireAdminAuth, async (req, res) => {
  try {
    const { studentId, xpAmount, transactionType, description, metadata } = req.body;
    
    // Validation
    if (!studentId || !xpAmount || !transactionType || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentId, xpAmount, transactionType, description'
      });
    }
    
    if (typeof xpAmount !== 'number' || xpAmount === 0) {
      return res.status(400).json({
        success: false,
        message: 'XP amount must be a non-zero number'
      });
    }
    
    const result = await xpService.awardXP(
      parseInt(studentId),
      xpAmount,
      transactionType,
      description,
      metadata || {}
    );
    
    res.json({
      success: true,
      data: result,
      message: `${xpAmount > 0 ? 'Awarded' : 'Deducted'} ${Math.abs(xpAmount)} XP`
    });
  } catch (error) {
    console.error('Error awarding XP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to award XP'
    });
  }
});

/**
 * @route GET /api/xp/student/:studentId
 * @desc Get XP information for specific student (admin only)
 * @access Private (Admin)
 */
router.get('/student/:studentId', requireAdminAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID'
      });
    }
    
    const xpStats = await xpService.getStudentXPStats(parseInt(studentId));
    
    res.json({
      success: true,
      data: xpStats
    });
  } catch (error) {
    console.error('Error getting student XP info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get student XP information'
    });
  }
});

/**
 * @route GET /api/xp/student/:studentId/history
 * @desc Get XP transaction history for specific student (admin only)
 * @access Private (Admin)
 */
router.get('/student/:studentId/history', requireAdminAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { limit = 50 } = req.query;
    
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID'
      });
    }
    
    const limitNum = Math.min(parseInt(limit) || 50, 200); // Max 200 entries
    const history = await xpService.getXPTransactionHistory(parseInt(studentId), limitNum);
    
    res.json({
      success: true,
      data: {
        studentId: parseInt(studentId),
        limit: limitNum,
        history
      }
    });
  } catch (error) {
    console.error('Error getting student XP history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get student XP transaction history'
    });
  }
});

/**
 * @route GET /api/xp/level-calculator
 * @desc Calculate level for given XP amount
 * @access Public
 */
router.get('/level-calculator', (req, res) => {
  try {
    const { xp } = req.query;
    
    if (!xp || isNaN(xp) || parseInt(xp) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid XP amount'
      });
    }
    
    const totalXP = parseInt(xp);
    const levelInfo = xpService.calculateLevel(totalXP);
    const levelTitle = xpService.getLevelTitle(levelInfo.currentLevel);
    
    res.json({
      success: true,
      data: {
        totalXP,
        ...levelInfo,
        levelTitle
      }
    });
  } catch (error) {
    console.error('Error calculating level:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate level'
    });
  }
});

/**
 * @route GET /api/xp/rewards
 * @desc Get information about XP rewards for different activities
 * @access Public
 */
router.get('/rewards', (req, res) => {
  try {
    const rewards = {
      lessonCompletion: {
        base: 50,
        description: 'Base XP for completing any lesson',
        bonuses: {
          accuracy: {
            description: 'Up to 50% bonus based on accuracy',
            maxBonus: 25
          },
          speed: {
            description: 'Up to 25% bonus for fast completion',
            maxBonus: 12
          },
          perfectScore: {
            description: 'Bonus for 100% accuracy',
            bonus: 25
          }
        }
      },
      streakMilestones: {
        description: 'XP awarded for streak milestones',
        milestones: [
          { days: 3, xp: 100 },
          { days: 7, xp: 200 },
          { days: 14, xp: 300 },
          { days: 30, xp: 500 },
          { days: 50, xp: 750 },
          { days: 100, xp: 1000 },
          { days: 365, xp: 2000 }
        ]
      },
      levelUpBonus: {
        description: 'Bonus XP for leveling up',
        formula: 'Level × 50',
        examples: [
          { level: 2, bonus: 100 },
          { level: 5, bonus: 250 },
          { level: 10, bonus: 500 }
        ]
      },
      achievements: {
        description: 'XP awarded for earning achievements',
        range: '50-1000 XP depending on achievement difficulty'
      }
    };
    
    res.json({
      success: true,
      data: rewards
    });
  } catch (error) {
    console.error('Error getting XP rewards info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get XP rewards information'
    });
  }
});

module.exports = router;