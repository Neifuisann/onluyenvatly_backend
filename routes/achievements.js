const express = require('express');
const router = express.Router();
const achievementService = require('../lib/services/achievementService');
const { requireStudentAuth, requireAdminAuth } = require('../lib/middleware/auth');

/**
 * @route GET /api/achievements
 * @desc Get all available achievements
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const achievements = await achievementService.getAllAchievements();
    
    res.json({
      success: true,
      data: {
        achievements
      }
    });
  } catch (error) {
    console.error('Error getting achievements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get achievements'
    });
  }
});

/**
 * @route GET /api/achievements/student
 * @desc Get earned achievements for authenticated student
 * @access Private (Student)
 */
router.get('/student', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    const achievements = await achievementService.getStudentAchievements(studentId);
    
    res.json({
      success: true,
      data: {
        achievements
      }
    });
  } catch (error) {
    console.error('Error getting student achievements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get student achievements'
    });
  }
});

/**
 * @route GET /api/achievements/student/:studentId
 * @desc Get earned achievements for specific student (admin only)
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
    
    const achievements = await achievementService.getStudentAchievements(parseInt(studentId));
    
    res.json({
      success: true,
      data: {
        studentId: parseInt(studentId),
        achievements
      }
    });
  } catch (error) {
    console.error('Error getting student achievements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get student achievements'
    });
  }
});

/**
 * @route GET /api/achievements/progress
 * @desc Get achievement progress for authenticated student
 * @access Private (Student)
 */
router.get('/progress', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    
    // Get all achievements and student's earned achievements
    const [allAchievements, studentAchievements] = await Promise.all([
      achievementService.getAllAchievements(),
      achievementService.getStudentAchievements(studentId)
    ]);
    
    const earnedIds = studentAchievements.map(a => a.achievement_id);
    
    // Categorize achievements
    const progress = {
      earned: studentAchievements,
      available: allAchievements.filter(a => !earnedIds.includes(a.id)),
      totalAchievements: allAchievements.length,
      earnedCount: studentAchievements.length,
      progressPercentage: Math.round((studentAchievements.length / allAchievements.length) * 100)
    };
    
    // Group by category
    const byCategory = {};
    allAchievements.forEach(achievement => {
      const category = achievement.category;
      if (!byCategory[category]) {
        byCategory[category] = {
          total: 0,
          earned: 0,
          achievements: []
        };
      }
      byCategory[category].total++;
      byCategory[category].achievements.push(achievement);
      
      if (earnedIds.includes(achievement.id)) {
        byCategory[category].earned++;
      }
    });
    
    // Calculate progress percentage for each category
    Object.keys(byCategory).forEach(category => {
      byCategory[category].progressPercentage = Math.round(
        (byCategory[category].earned / byCategory[category].total) * 100
      );
    });
    
    res.json({
      success: true,
      data: {
        progress,
        byCategory
      }
    });
  } catch (error) {
    console.error('Error getting achievement progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get achievement progress'
    });
  }
});

/**
 * @route POST /api/achievements/check
 * @desc Manually check achievements for authenticated student
 * @access Private (Student)
 */
router.post('/check', requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { activityType = 'manual_check', activityData = {} } = req.body;
    
    const newAchievements = await achievementService.checkAndAwardAchievements(
      studentId,
      activityType,
      activityData
    );
    
    res.json({
      success: true,
      data: {
        newAchievements,
        count: newAchievements.length
      },
      message: newAchievements.length > 0 
        ? `Congratulations! You earned ${newAchievements.length} new achievement${newAchievements.length > 1 ? 's' : ''}!`
        : 'No new achievements earned at this time.'
    });
  } catch (error) {
    console.error('Error checking achievements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check achievements'
    });
  }
});

/**
 * @route GET /api/achievements/statistics
 * @desc Get achievement statistics
 * @access Public
 */
router.get('/statistics', async (req, res) => {
  try {
    const statistics = await achievementService.getAchievementStatistics();
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error getting achievement statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get achievement statistics'
    });
  }
});

/**
 * @route GET /api/achievements/leaderboard
 * @desc Get achievement leaderboard
 * @access Public
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    
    // Get students with most achievements
    const { data: leaderboard, error } = await require('../lib/config/database').supabase
      .from('student_achievements')
      .select(`
        student_id,
        students (full_name),
        count:student_id.count()
      `)
      .group('student_id, students.full_name')
      .order('count', { ascending: false })
      .limit(limitNum);
    
    if (error) throw error;
    
    const formattedLeaderboard = leaderboard?.map((entry, index) => ({
      rank: index + 1,
      studentId: entry.student_id,
      studentName: entry.students?.full_name || 'Unknown Student',
      achievementCount: entry.count
    })) || [];
    
    res.json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error getting achievement leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get achievement leaderboard'
    });
  }
});

/**
 * @route POST /api/achievements/award
 * @desc Manually award achievement to student (admin only)
 * @access Private (Admin)
 */
router.post('/award', requireAdminAuth, async (req, res) => {
  try {
    const { studentId, achievementId, metadata } = req.body;
    
    if (!studentId || !achievementId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentId, achievementId'
      });
    }
    
    // Check if student already has this achievement
    const existingAchievements = await achievementService.getStudentAchievements(parseInt(studentId));
    const alreadyHas = existingAchievements.some(a => a.achievement_id === parseInt(achievementId));
    
    if (alreadyHas) {
      return res.status(400).json({
        success: false,
        message: 'Student already has this achievement'
      });
    }
    
    const awardedAchievement = await achievementService.awardAchievement(
      parseInt(studentId),
      parseInt(achievementId),
      { ...metadata, awardedBy: 'admin' }
    );
    
    res.json({
      success: true,
      data: awardedAchievement,
      message: 'Achievement awarded successfully'
    });
  } catch (error) {
    console.error('Error awarding achievement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to award achievement'
    });
  }
});

/**
 * @route GET /api/achievements/categories
 * @desc Get achievement categories with counts
 * @access Public
 */
router.get('/categories', async (req, res) => {
  try {
    const achievements = await achievementService.getAllAchievements();
    
    // Group by category
    const categories = {};
    achievements.forEach(achievement => {
      const category = achievement.category;
      if (!categories[category]) {
        categories[category] = {
          name: category,
          displayName: this.getCategoryDisplayName(category),
          description: this.getCategoryDescription(category),
          icon: this.getCategoryIcon(category),
          achievements: [],
          count: 0
        };
      }
      categories[category].achievements.push(achievement);
      categories[category].count++;
    });
    
    res.json({
      success: true,
      data: {
        categories: Object.values(categories)
      }
    });
  } catch (error) {
    console.error('Error getting achievement categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get achievement categories'
    });
  }
});

// Helper methods for category information
function getCategoryDisplayName(category) {
  const names = {
    discovery: 'Discovery',
    mastery: 'Mastery',
    social: 'Social',
    persistence: 'Persistence',
    accuracy: 'Accuracy',
    speed: 'Speed',
    special: 'Special'
  };
  return names[category] || category;
}

function getCategoryDescription(category) {
  const descriptions = {
    discovery: 'Achievements for exploring new concepts and lessons',
    mastery: 'Achievements for demonstrating deep understanding',
    social: 'Achievements for community participation and helping others',
    persistence: 'Achievements for consistent learning and dedication',
    accuracy: 'Achievements for precision and correctness',
    speed: 'Achievements for quick and efficient learning',
    special: 'Special achievements for unique accomplishments'
  };
  return descriptions[category] || 'Achievements in this category';
}

function getCategoryIcon(category) {
  const icons = {
    discovery: '🔍',
    mastery: '🎓',
    social: '👥',
    persistence: '💪',
    accuracy: '🎯',
    speed: '⚡',
    special: '⭐'
  };
  return icons[category] || '🏆';
}

module.exports = router;