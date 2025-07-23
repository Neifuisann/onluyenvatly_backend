const { supabase } = require('../config/database');

class ActivityService {
  /**
   * Create a new activity feed entry
   * @param {number} studentId - Student ID
   * @param {string} activityType - Type of activity
   * @param {string} title - Activity title
   * @param {string} description - Activity description
   * @param {Object} metadata - Additional activity data
   * @param {boolean} isPublic - Whether activity is visible to others
   * @returns {Promise<Object>} Created activity
   */
  async createActivity(studentId, activityType, title, description = '', metadata = {}, isPublic = true) {
    try {
      const { data: activity, error } = await supabase
        .from('activity_feed')
        .insert({
          student_id: studentId,
          activity_type: activityType,
          title,
          description,
          metadata,
          is_public: isPublic,
          created_at: new Date().toISOString()
        })
        .select(`
          *,
          students (
            id,
            full_name,
            username
          )
        `)
        .single();

      if (error) throw error;
      return activity;
    } catch (error) {
      console.error('Error creating activity:', error);
      throw error;
    }
  }

  /**
   * Get public activity feed
   * @param {number} limit - Number of activities to fetch
   * @param {number} offset - Offset for pagination
   * @param {Array} activityTypes - Filter by activity types
   * @returns {Promise<Array>} Array of activities
   */
  async getPublicActivityFeed(limit = 20, offset = 0, activityTypes = []) {
    try {
      let query = supabase
        .from('activity_feed')
        .select(`
          *,
          students (
            id,
            full_name,
            username
          )
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (activityTypes.length > 0) {
        query = query.in('activity_type', activityTypes);
      }

      const { data: activities, error } = await query;
      if (error) throw error;

      return activities || [];
    } catch (error) {
      console.error('Error getting public activity feed:', error);
      return [];
    }
  }

  /**
   * Get student's personal activity feed
   * @param {number} studentId - Student ID
   * @param {number} limit - Number of activities to fetch
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Array>} Array of activities
   */
  async getStudentActivityFeed(studentId, limit = 50, offset = 0) {
    try {
      const { data: activities, error } = await supabase
        .from('activity_feed')
        .select(`
          *,
          students (
            id,
            full_name,
            username
          )
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return activities || [];
    } catch (error) {
      console.error('Error getting student activity feed:', error);
      return [];
    }
  }

  /**
   * Log lesson completion activity
   * @param {number} studentId - Student ID
   * @param {string} lessonId - Lesson ID
   * @param {Object} lessonData - Lesson information
   * @param {number} score - Score achieved
   * @param {number} totalPoints - Total possible points
   * @param {boolean} isPublic - Whether to make public
   * @returns {Promise<Object>} Created activity
   */
  async logLessonCompletion(studentId, lessonId, lessonData, score, totalPoints, isPublic = true) {
    try {
      const accuracy = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
      const isPerfect = accuracy === 100;
      
      let title, description;
      
      if (isPerfect) {
        title = `🌟 Perfect score on "${lessonData.title}"!`;
        description = `Achieved 100% accuracy on ${lessonData.subject} lesson`;
      } else if (accuracy >= 90) {
        title = `🎯 Excellent work on "${lessonData.title}"`;
        description = `Scored ${accuracy}% on ${lessonData.subject} lesson`;
      } else if (accuracy >= 70) {
        title = `📚 Completed "${lessonData.title}"`;
        description = `Scored ${accuracy}% on ${lessonData.subject} lesson`;
      } else {
        // Don't create public activity for low scores, but create private one
        title = `📖 Practiced "${lessonData.title}"`;
        description = `Worked on ${lessonData.subject} lesson`;
        isPublic = false;
      }

      return await this.createActivity(
        studentId,
        'lesson_completed',
        title,
        description,
        {
          lessonId,
          lessonTitle: lessonData.title,
          subject: lessonData.subject,
          score,
          totalPoints,
          accuracy,
          isPerfect
        },
        isPublic
      );
    } catch (error) {
      console.error('Error logging lesson completion activity:', error);
      return null;
    }
  }

  /**
   * Log achievement earned activity
   * @param {number} studentId - Student ID
   * @param {Object} achievement - Achievement data
   * @returns {Promise<Object>} Created activity
   */
  async logAchievementEarned(studentId, achievement) {
    try {
      return await this.createActivity(
        studentId,
        'achievement_earned',
        `🏆 Earned "${achievement.title}" achievement!`,
        achievement.description,
        {
          achievementId: achievement.id,
          achievementName: achievement.name,
          category: achievement.category,
          badgeIcon: achievement.badge_icon,
          xpReward: achievement.xp_reward
        },
        true
      );
    } catch (error) {
      console.error('Error logging achievement activity:', error);
      return null;
    }
  }

  /**
   * Log streak milestone activity
   * @param {number} studentId - Student ID
   * @param {number} streakDays - Streak days achieved
   * @param {number} xpReward - XP reward for milestone
   * @returns {Promise<Object>} Created activity
   */
  async logStreakMilestone(studentId, streakDays, xpReward) {
    try {
      let title, description;
      
      if (streakDays >= 100) {
        title = `🔥💯 Incredible ${streakDays}-day learning streak!`;
        description = `Maintained a ${streakDays}-day streak - truly dedicated!`;
      } else if (streakDays >= 30) {
        title = `🔥 Amazing ${streakDays}-day learning streak!`;
        description = `Maintained a ${streakDays}-day streak - great dedication!`;
      } else if (streakDays >= 7) {
        title = `🔥 ${streakDays}-day learning streak!`;
        description = `Maintained a ${streakDays}-day streak - keep it up!`;
      } else {
        title = `🔥 ${streakDays}-day streak milestone`;
        description = `Reached ${streakDays} consecutive days of learning`;
      }

      return await this.createActivity(
        studentId,
        'streak_milestone',
        title,
        description,
        {
          streakDays,
          xpReward,
          milestoneType: 'streak'
        },
        true
      );
    } catch (error) {
      console.error('Error logging streak milestone activity:', error);
      return null;
    }
  }

  /**
   * Log XP level up activity
   * @param {number} studentId - Student ID
   * @param {number} newLevel - New level achieved
   * @param {string} levelTitle - Level title
   * @param {number} totalXP - Total XP accumulated
   * @returns {Promise<Object>} Created activity
   */
  async logLevelUp(studentId, newLevel, levelTitle, totalXP) {
    try {
      let title, description;
      
      if (newLevel >= 20) {
        title = `⚡ Level ${newLevel}: ${levelTitle} - Physics Master!`;
        description = `Reached the legendary level ${newLevel} with ${totalXP.toLocaleString()} XP!`;
      } else if (newLevel >= 15) {
        title = `🌟 Level ${newLevel}: ${levelTitle}`;
        description = `Advanced to level ${newLevel} with ${totalXP.toLocaleString()} XP!`;
      } else if (newLevel >= 10) {
        title = `📚 Level ${newLevel}: ${levelTitle}`;
        description = `Leveled up to ${newLevel} with ${totalXP.toLocaleString()} XP`;
      } else {
        title = `🎯 Level ${newLevel}: ${levelTitle}`;
        description = `Reached level ${newLevel} with ${totalXP.toLocaleString()} XP`;
      }

      return await this.createActivity(
        studentId,
        'level_up',
        title,
        description,
        {
          newLevel,
          levelTitle,
          totalXP,
          milestone: newLevel % 5 === 0 // Mark every 5th level as milestone
        },
        true
      );
    } catch (error) {
      console.error('Error logging level up activity:', error);
      return null;
    }
  }

  /**
   * Log quest completion activity
   * @param {number} studentId - Student ID
   * @param {Object} quest - Completed quest
   * @returns {Promise<Object>} Created activity
   */
  async logQuestCompletion(studentId, quest) {
    try {
      return await this.createActivity(
        studentId,
        'quest_completed',
        `✅ Completed daily quest: "${quest.title}"`,
        quest.description,
        {
          questId: quest.id,
          questType: quest.quest_type,
          xpReward: quest.xp_reward,
          streakShieldReward: quest.streak_shield_reward
        },
        true
      );
    } catch (error) {
      console.error('Error logging quest completion activity:', error);
      return null;
    }
  }

  /**
   * Get activity statistics
   * @param {Date} startDate - Start date for statistics
   * @param {Date} endDate - End date for statistics
   * @returns {Promise<Object>} Activity statistics
   */
  async getActivityStatistics(startDate, endDate) {
    try {
      const { data: activities, error } = await supabase
        .from('activity_feed')
        .select('activity_type, is_public, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      const stats = {
        totalActivities: activities.length,
        publicActivities: activities.filter(a => a.is_public).length,
        privateActivities: activities.filter(a => !a.is_public).length,
        activitiesByType: {},
        activitiesByDay: {}
      };

      // Group by type
      activities.forEach(activity => {
        const type = activity.activity_type;
        if (!stats.activitiesByType[type]) {
          stats.activitiesByType[type] = 0;
        }
        stats.activitiesByType[type]++;
      });

      // Group by day
      activities.forEach(activity => {
        const day = activity.created_at.split('T')[0];
        if (!stats.activitiesByDay[day]) {
          stats.activitiesByDay[day] = 0;
        }
        stats.activitiesByDay[day]++;
      });

      return stats;
    } catch (error) {
      console.error('Error getting activity statistics:', error);
      return {
        totalActivities: 0,
        publicActivities: 0,
        privateActivities: 0,
        activitiesByType: {},
        activitiesByDay: {}
      };
    }
  }

  /**
   * Get trending activities (most engaged with)
   * @param {number} limit - Number of trending activities
   * @param {number} hoursBack - How many hours back to look
   * @returns {Promise<Array>} Trending activities
   */
  async getTrendingActivities(limit = 10, hoursBack = 24) {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

      const { data: activities, error } = await supabase
        .from('activity_feed')
        .select(`
          *,
          students (
            id,
            full_name,
            username
          )
        `)
        .eq('is_public', true)
        .gte('created_at', cutoffTime.toISOString())
        .in('activity_type', ['achievement_earned', 'streak_milestone', 'level_up'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return activities || [];
    } catch (error) {
      console.error('Error getting trending activities:', error);
      return [];
    }
  }

  /**
   * Get leaderboard activities (top performers)
   * @param {number} limit - Number of top performers
   * @returns {Promise<Array>} Top performer activities
   */
  async getLeaderboardActivities(limit = 5) {
    try {
      // Get recent high-achievement activities
      const { data: activities, error } = await supabase
        .from('activity_feed')
        .select(`
          *,
          students (
            id,
            full_name,
            username
          )
        `)
        .eq('is_public', true)
        .in('activity_type', ['achievement_earned', 'streak_milestone', 'level_up'])
        .order('created_at', { ascending: false })
        .limit(limit * 3); // Get more to filter from

      if (error) throw error;

      // Filter to unique students and prioritize by activity importance
      const uniqueStudents = new Map();
      const priorityOrder = {
        'level_up': 3,
        'streak_milestone': 2,
        'achievement_earned': 1
      };

      activities?.forEach(activity => {
        const studentId = activity.student_id;
        const priority = priorityOrder[activity.activity_type] || 0;
        
        if (!uniqueStudents.has(studentId) || 
            uniqueStudents.get(studentId).priority < priority) {
          uniqueStudents.set(studentId, { ...activity, priority });
        }
      });

      return Array.from(uniqueStudents.values())
        .sort((a, b) => b.priority - a.priority || new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting leaderboard activities:', error);
      return [];
    }
  }

  /**
   * Clean up old activities (keep only recent ones)
   * @param {number} daysToKeep - Number of days to keep
   * @returns {Promise<number>} Number of deleted activities
   */
  async cleanupOldActivities(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { data, error } = await supabase
        .from('activity_feed')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) throw error;
      
      const deletedCount = data?.length || 0;
      console.log(`Cleaned up ${deletedCount} old activities older than ${daysToKeep} days`);
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old activities:', error);
      return 0;
    }
  }
}

module.exports = new ActivityService();