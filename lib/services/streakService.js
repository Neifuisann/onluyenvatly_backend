const { supabase } = require('../config/database');
const databaseService = require('./databaseService');

class StreakService {
  /**
   * Initialize or update student streak based on activity
   * @param {number} studentId - Student ID
   * @returns {Promise<Object>} Updated streak information
   */
  async updateStudentStreak(studentId) {
    try {
      // Get current streak record
      let streakRecord = await this.getStreakRecord(studentId);
      
      const today = new Date();
      const todayDateString = today.toDateString();
      
      if (!streakRecord) {
        // Create new streak record
        streakRecord = await this.createStreakRecord(studentId);
      }
      
      const lastActivityDate = streakRecord.last_activity_date ? 
        new Date(streakRecord.last_activity_date) : null;
      const lastActivityDateString = lastActivityDate ? lastActivityDate.toDateString() : null;
      
      // Check if student already has activity today
      if (lastActivityDateString === todayDateString) {
        return streakRecord; // No update needed
      }
      
      // Calculate days since last activity
      const daysSinceLastActivity = lastActivityDate ? 
        Math.floor((today - lastActivityDate) / (1000 * 60 * 60 * 24)) : 0;
      
      let newCurrentStreak = streakRecord.current_streak;
      let newLongestStreak = streakRecord.longest_streak;
      
      if (daysSinceLastActivity === 1) {
        // Consecutive day - increment streak
        newCurrentStreak += 1;
        newLongestStreak = Math.max(newLongestStreak, newCurrentStreak);
      } else if (daysSinceLastActivity > 1) {
        // Streak broken - start new streak
        newCurrentStreak = 1;
      } else if (daysSinceLastActivity === 0 && lastActivityDate) {
        // Same day activity
        return streakRecord;
      } else {
        // First day of activity
        newCurrentStreak = 1;
        newLongestStreak = Math.max(newLongestStreak, 1);
      }
      
      // Update streak record
      const { data: updatedStreak, error } = await supabase
        .from('student_streaks')
        .update({
          current_streak: newCurrentStreak,
          longest_streak: newLongestStreak,
          last_activity_date: today.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('student_id', studentId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Check for streak milestones and award XP
      await this.checkStreakMilestones(studentId, newCurrentStreak, streakRecord.current_streak);
      
      return updatedStreak;
    } catch (error) {
      console.error('Error updating student streak:', error);
      throw error;
    }
  }
  
  /**
   * Get streak record for a student
   * @param {number} studentId - Student ID
   * @returns {Promise<Object|null>} Streak record or null
   */
  async getStreakRecord(studentId) {
    try {
      const { data: streak, error } = await supabase
        .from('student_streaks')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();
      
      if (error) throw error;
      return streak;
    } catch (error) {
      console.error('Error getting streak record:', error);
      throw error;
    }
  }
  
  /**
   * Create initial streak record for a student
   * @param {number} studentId - Student ID
   * @returns {Promise<Object>} Created streak record
   */
  async createStreakRecord(studentId) {
    try {
      const { data: newStreak, error } = await supabase
        .from('student_streaks')
        .insert({
          student_id: studentId,
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null,
          streak_freezes_available: 3,
          streak_freezes_used: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return newStreak;
    } catch (error) {
      console.error('Error creating streak record:', error);
      throw error;
    }
  }
  
  /**
   * Use a streak freeze to protect streak
   * @param {number} studentId - Student ID
   * @returns {Promise<Object>} Updated streak information
   */
  async useStreakFreeze(studentId) {
    try {
      const streakRecord = await this.getStreakRecord(studentId);
      if (!streakRecord) {
        throw new Error('Streak record not found');
      }
      
      if (streakRecord.streak_freezes_available <= 0) {
        throw new Error('No streak freezes available');
      }
      
      const { data: updatedStreak, error } = await supabase
        .from('student_streaks')
        .update({
          streak_freezes_available: streakRecord.streak_freezes_available - 1,
          streak_freezes_used: streakRecord.streak_freezes_used + 1,
          last_activity_date: new Date().toISOString(), // Extend last activity to today
          updated_at: new Date().toISOString()
        })
        .eq('student_id', studentId)
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        success: true,
        streak: updatedStreak,
        message: 'Streak freeze used successfully'
      };
    } catch (error) {
      console.error('Error using streak freeze:', error);
      throw error;
    }
  }
  
  /**
   * Get streak statistics for display
   * @param {number} studentId - Student ID
   * @returns {Promise<Object>} Streak statistics
   */
  async getStreakStats(studentId) {
    try {
      const streakRecord = await this.getStreakRecord(studentId);
      
      if (!streakRecord) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          streakFreezesAvailable: 3,
          streakFreezesUsed: 0,
          lastActivityDate: null,
          streakStatus: 'inactive',
          daysUntilStreakLoss: 0
        };
      }
      
      const today = new Date();
      const lastActivityDate = streakRecord.last_activity_date ? 
        new Date(streakRecord.last_activity_date) : null;
      
      let streakStatus = 'active';
      let daysUntilStreakLoss = 1;
      
      if (lastActivityDate) {
        const daysSinceLastActivity = Math.floor((today - lastActivityDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastActivity === 0) {
          streakStatus = 'active_today';
          daysUntilStreakLoss = 1;
        } else if (daysSinceLastActivity === 1) {
          streakStatus = 'at_risk';
          daysUntilStreakLoss = 0;
        } else if (daysSinceLastActivity > 1) {
          streakStatus = 'broken';
          daysUntilStreakLoss = 0;
        }
      }
      
      return {
        currentStreak: streakRecord.current_streak,
        longestStreak: streakRecord.longest_streak,
        streakFreezesAvailable: streakRecord.streak_freezes_available,
        streakFreezesUsed: streakRecord.streak_freezes_used,
        lastActivityDate: streakRecord.last_activity_date,
        streakStatus,
        daysUntilStreakLoss,
        canUseFreeze: streakRecord.streak_freezes_available > 0 && streakStatus === 'at_risk'
      };
    } catch (error) {
      console.error('Error getting streak stats:', error);
      return {
        currentStreak: 0,
        longestStreak: 0,
        streakFreezesAvailable: 3,
        streakFreezesUsed: 0,
        lastActivityDate: null,
        streakStatus: 'inactive',
        daysUntilStreakLoss: 0,
        canUseFreeze: false
      };
    }
  }
  
  /**
   * Check for streak milestones and award achievements
   * @param {number} studentId - Student ID
   * @param {number} newStreak - New streak count
   * @param {number} oldStreak - Previous streak count
   */
  async checkStreakMilestones(studentId, newStreak, oldStreak) {
    try {
      const milestones = [3, 7, 14, 30, 50, 100, 365];
      
      for (const milestone of milestones) {
        if (newStreak >= milestone && oldStreak < milestone) {
          // Award XP for streak milestone
          let xpReward = 0;
          let badgeName = '';
          
          switch (milestone) {
            case 3:
              xpReward = 50;
              badgeName = 'Getting Started';
              break;
            case 7:
              xpReward = 100;
              badgeName = 'Week Warrior';
              break;
            case 14:
              xpReward = 200;
              badgeName = 'Two Week Champion';
              break;
            case 30:
              xpReward = 500;
              badgeName = 'Monthly Master';
              break;
            case 50:
              xpReward = 750;
              badgeName = 'Persistent Learner';
              break;
            case 100:
              xpReward = 1000;
              badgeName = 'Century Scholar';
              break;
            case 365:
              xpReward = 2000;
              badgeName = 'Year-long Legend';
              break;
          }
          
          // TODO: Award XP through XP service when implemented
          // TODO: Award achievement badge when achievement system is implemented
          
          console.log(`Student ${studentId} achieved ${milestone}-day streak milestone: ${badgeName} (+${xpReward} XP)`);
        }
      }
    } catch (error) {
      console.error('Error checking streak milestones:', error);
    }
  }
  
  /**
   * Get top streak performers
   * @param {number} limit - Number of top performers to return
   * @returns {Promise<Array>} Top streak performers
   */
  async getTopStreakPerformers(limit = 10) {
    try {
      const { data: topPerformers, error } = await supabase
        .from('student_streaks')
        .select(`
          student_id,
          current_streak,
          longest_streak,
          students ( full_name )
        `)
        .order('current_streak', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return topPerformers?.map(performer => ({
        studentId: performer.student_id,
        studentName: performer.students?.full_name || 'Unknown Student',
        currentStreak: performer.current_streak,
        longestStreak: performer.longest_streak
      })) || [];
    } catch (error) {
      console.error('Error getting top streak performers:', error);
      return [];
    }
  }
  
  /**
   * Get streak leaderboard
   * @param {string} period - 'current' or 'longest'
   * @param {number} limit - Number of entries to return
   * @returns {Promise<Array>} Streak leaderboard
   */
  async getStreakLeaderboard(period = 'current', limit = 50) {
    try {
      const orderColumn = period === 'longest' ? 'longest_streak' : 'current_streak';
      
      const { data: leaderboard, error } = await supabase
        .from('student_streaks')
        .select(`
          student_id,
          current_streak,
          longest_streak,
          last_activity_date,
          students ( full_name )
        `)
        .order(orderColumn, { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return leaderboard?.map((entry, index) => ({
        rank: index + 1,
        studentId: entry.student_id,
        studentName: entry.students?.full_name || 'Unknown Student',
        currentStreak: entry.current_streak,
        longestStreak: entry.longest_streak,
        lastActivityDate: entry.last_activity_date,
        displayValue: period === 'longest' ? entry.longest_streak : entry.current_streak
      })) || [];
    } catch (error) {
      console.error('Error getting streak leaderboard:', error);
      return [];
    }
  }
  
  /**
   * Reset streak freeze availability (monthly reset)
   * @param {number} studentId - Student ID (optional, if null resets for all students)
   * @returns {Promise<Object>} Reset result
   */
  async resetStreakFreezes(studentId = null) {
    try {
      let query = supabase
        .from('student_streaks')
        .update({
          streak_freezes_available: 3,
          updated_at: new Date().toISOString()
        });
      
      if (studentId) {
        query = query.eq('student_id', studentId);
      }
      
      const { error } = await query;
      if (error) throw error;
      
      return {
        success: true,
        message: studentId ? 
          'Streak freezes reset for student' : 
          'Streak freezes reset for all students'
      };
    } catch (error) {
      console.error('Error resetting streak freezes:', error);
      throw error;
    }
  }
  
  /**
   * Record daily streak activity (called when student completes lesson)
   * @param {number} studentId - Student ID
   * @returns {Promise<Object>} Updated streak information
   */
  async recordDailyActivity(studentId) {
    try {
      const updatedStreak = await this.updateStudentStreak(studentId);
      
      // Get formatted streak stats for response
      const streakStats = await this.getStreakStats(studentId);
      
      return {
        success: true,
        streak: updatedStreak,
        stats: streakStats,
        message: `Streak updated to ${streakStats.currentStreak} days`
      };
    } catch (error) {
      console.error('Error recording daily activity:', error);
      throw error;
    }
  }
  
  /**
   * Get streak activity history for a student
   * @param {number} studentId - Student ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} Activity history
   */
  async getStreakActivityHistory(studentId, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      // Get lesson completion activity in the time range
      const { data: activities, error } = await supabase
        .from('results')
        .select('timestamp, score, lessonId')
        .eq('student_id', studentId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      
      // Group activities by date
      const activityByDate = {};
      activities?.forEach(activity => {
        const date = new Date(activity.timestamp).toDateString();
        if (!activityByDate[date]) {
          activityByDate[date] = {
            date: date,
            hasActivity: true,
            lessonCount: 0,
            totalScore: 0
          };
        }
        activityByDate[date].lessonCount++;
        activityByDate[date].totalScore += activity.score;
      });
      
      // Create complete history array
      const history = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(endDate.getTime() - (i * 24 * 60 * 60 * 1000));
        const dateString = date.toDateString();
        
        history.unshift({
          date: dateString,
          hasActivity: !!activityByDate[dateString],
          lessonCount: activityByDate[dateString]?.lessonCount || 0,
          totalScore: activityByDate[dateString]?.totalScore || 0
        });
      }
      
      return history;
    } catch (error) {
      console.error('Error getting streak activity history:', error);
      return [];
    }
  }
}

module.exports = new StreakService();