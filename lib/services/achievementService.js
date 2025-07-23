const { supabase } = require('../config/database');
const xpService = require('./xpService');

class AchievementService {
  /**
   * Check and award achievements for a student based on their activity
   * @param {number} studentId - Student ID
   * @param {string} activityType - Type of activity that might trigger achievements
   * @param {Object} activityData - Data about the activity
   * @returns {Promise<Array>} Array of newly earned achievements
   */
  async checkAndAwardAchievements(studentId, activityType, activityData = {}) {
    try {
      // Get all active achievements
      const allAchievements = await this.getAllAchievements();
      
      // Get student's current achievements
      const studentAchievements = await this.getStudentAchievements(studentId);
      const earnedAchievementIds = studentAchievements.map(a => a.achievement_id);
      
      // Filter out already earned achievements
      const availableAchievements = allAchievements.filter(
        achievement => !earnedAchievementIds.includes(achievement.id)
      );
      
      const newlyEarned = [];
      
      // Check each available achievement
      for (const achievement of availableAchievements) {
        const earned = await this.checkAchievementRequirements(
          studentId, 
          achievement, 
          activityType, 
          activityData
        );
        
        if (earned) {
          const awardedAchievement = await this.awardAchievement(studentId, achievement.id, activityData);
          newlyEarned.push(awardedAchievement);
        }
      }
      
      return newlyEarned;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }
  
  /**
   * Check if a student meets the requirements for a specific achievement
   * @param {number} studentId - Student ID
   * @param {Object} achievement - Achievement object
   * @param {string} activityType - Current activity type
   * @param {Object} activityData - Activity data
   * @returns {Promise<boolean>} Whether the achievement is earned
   */
  async checkAchievementRequirements(studentId, achievement, activityType, activityData) {
    try {
      const requirements = achievement.requirements;
      
      switch (achievement.name) {
        case 'first_lesson':
          return await this.checkLessonCompletion(studentId, 1);
          
        case 'lessons_10':
          return await this.checkLessonCompletion(studentId, 10);
          
        case 'lessons_50':
          return await this.checkLessonCompletion(studentId, 50);
          
        case 'lessons_100':
          return await this.checkLessonCompletion(studentId, 100);
          
        case 'streak_3':
          return await this.checkStreak(studentId, 3);
          
        case 'streak_7':
          return await this.checkStreak(studentId, 7);
          
        case 'streak_30':
          return await this.checkStreak(studentId, 30);
          
        case 'streak_100':
          return await this.checkStreak(studentId, 100);
          
        case 'accuracy_90':
          return await this.checkAccuracy(studentId, 90, 5);
          
        case 'accuracy_95':
          return await this.checkAccuracy(studentId, 95, 10);
          
        case 'perfectionist':
          return await this.checkPerfectScores(studentId, 1);
          
        case 'perfect_master':
          return await this.checkPerfectScores(studentId, 10);
          
        case 'speed_demon':
          return await this.checkSpeedCompletion(studentId, 300); // 5 minutes
          
        case 'lightning_fast':
          return await this.checkSpeedCompletion(studentId, 180); // 3 minutes
          
        case 'subject_master_mechanics':
          return await this.checkSubjectMastery(studentId, 'Mechanics', 15);
          
        case 'subject_master_waves':
          return await this.checkSubjectMastery(studentId, 'Waves', 15);
          
        case 'subject_master_electricity':
          return await this.checkSubjectMastery(studentId, 'Electricity', 15);
          
        case 'physics_scholar':
          return await this.checkMultipleSubjects(studentId, 3, 10); // 3 subjects, 10 lessons each
          
        case 'early_bird':
          return await this.checkTimeOfDayPattern(studentId, 'morning');
          
        case 'night_owl':
          return await this.checkTimeOfDayPattern(studentId, 'night');
          
        case 'weekend_warrior':
          return await this.checkWeekendActivity(studentId, 10);
          
        case 'daily_dedication':
          return await this.checkConsecutiveDays(studentId, 7);
          
        case 'comeback_kid':
          return await this.checkComebackPattern(studentId);
          
        case 'improvement_seeker':
          return await this.checkImprovementPattern(studentId);
          
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking achievement requirements:', error);
      return false;
    }
  }
  
  /**
   * Award an achievement to a student
   * @param {number} studentId - Student ID
   * @param {number} achievementId - Achievement ID
   * @param {Object} metadata - Additional metadata about how it was earned
   * @returns {Promise<Object>} Awarded achievement data
   */
  async awardAchievement(studentId, achievementId, metadata = {}) {
    try {
      // Get achievement details
      const achievement = await this.getAchievementById(achievementId);
      if (!achievement) {
        throw new Error('Achievement not found');
      }
      
      // Record the achievement
      const { data: studentAchievement, error } = await supabase
        .from('student_achievements')
        .insert({
          student_id: studentId,
          achievement_id: achievementId,
          earned_at: new Date().toISOString(),
          metadata: metadata
        })
        .select('*')
        .single();
      
      if (error) throw error;
      
      // Award XP if the achievement has XP reward
      if (achievement.xp_reward > 0) {
        await xpService.awardXP(
          studentId,
          achievement.xp_reward,
          'achievement',
          `Earned achievement: ${achievement.title}`,
          {
            achievementId,
            achievementName: achievement.name,
            achievementTitle: achievement.title
          }
        );
      }
      
      // Create activity feed entry for social features
      await this.createAchievementActivity(studentId, achievement);
      
      console.log(`Achievement earned: ${achievement.title} (+${achievement.xp_reward} XP) by student ${studentId}`);
      
      return {
        ...studentAchievement,
        achievement: achievement
      };
    } catch (error) {
      console.error('Error awarding achievement:', error);
      throw error;
    }
  }
  
  /**
   * Get all active achievements
   * @returns {Promise<Array>} Array of achievement objects
   */
  async getAllAchievements() {
    try {
      const { data: achievements, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true)
        .order('category');
      
      if (error) throw error;
      return achievements || [];
    } catch (error) {
      console.error('Error getting all achievements:', error);
      return [];
    }
  }
  
  /**
   * Get achievement by ID
   * @param {number} achievementId - Achievement ID
   * @returns {Promise<Object|null>} Achievement object
   */
  async getAchievementById(achievementId) {
    try {
      const { data: achievement, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('id', achievementId)
        .single();
      
      if (error) throw error;
      return achievement;
    } catch (error) {
      console.error('Error getting achievement by ID:', error);
      return null;
    }
  }
  
  /**
   * Get student's earned achievements
   * @param {number} studentId - Student ID
   * @returns {Promise<Array>} Array of student achievement objects
   */
  async getStudentAchievements(studentId) {
    try {
      const { data: achievements, error } = await supabase
        .from('student_achievements')
        .select(`
          *,
          achievements (*)
        `)
        .eq('student_id', studentId)
        .order('earned_at', { ascending: false });
      
      if (error) throw error;
      return achievements || [];
    } catch (error) {
      console.error('Error getting student achievements:', error);
      return [];
    }
  }
  
  /**
   * Get achievement statistics
   * @returns {Promise<Object>} Achievement statistics
   */
  async getAchievementStatistics() {
    try {
      // Get total achievements
      const { count: totalAchievements } = await supabase
        .from('achievements')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      // Get most earned achievement
      const { data: mostEarned } = await supabase
        .from('student_achievements')
        .select(`
          achievement_id,
          achievements (title, badge_icon),
          count:achievement_id.count()
        `)
        .group('achievement_id, achievements.title, achievements.badge_icon')
        .order('count', { ascending: false })
        .limit(1);
      
      // Get recently earned achievements
      const { data: recentAchievements } = await supabase
        .from('student_achievements')
        .select(`
          earned_at,
          students (full_name),
          achievements (title, badge_icon)
        `)
        .order('earned_at', { ascending: false })
        .limit(10);
      
      return {
        totalAchievements: totalAchievements || 0,
        mostEarnedAchievement: mostEarned?.[0] || null,
        recentAchievements: recentAchievements || []
      };
    } catch (error) {
      console.error('Error getting achievement statistics:', error);
      return {
        totalAchievements: 0,
        mostEarnedAchievement: null,
        recentAchievements: []
      };
    }
  }
  
  // Achievement requirement checking methods
  
  async checkLessonCompletion(studentId, requiredCount) {
    const { count } = await supabase
      .from('results')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .gte('score', 1)
      .not('lessonId', 'eq', 'quiz_game');
    
    return (count || 0) >= requiredCount;
  }
  
  async checkStreak(studentId, requiredDays) {
    const { data: streak } = await supabase
      .from('student_streaks')
      .select('current_streak')
      .eq('student_id', studentId)
      .single();
    
    return (streak?.current_streak || 0) >= requiredDays;
  }
  
  async checkAccuracy(studentId, requiredAccuracy, minLessons) {
    const { data: results } = await supabase
      .from('results')
      .select('score, totalPoints')
      .eq('student_id', studentId)
      .not('lessonId', 'eq', 'quiz_game')
      .gt('totalPoints', 0);
    
    if (!results || results.length < minLessons) return false;
    
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const totalPossible = results.reduce((sum, r) => sum + r.totalPoints, 0);
    const accuracy = (totalScore / totalPossible) * 100;
    
    return accuracy >= requiredAccuracy;
  }
  
  async checkPerfectScores(studentId, requiredCount) {
    const { data: results } = await supabase
      .from('results')
      .select('score, totalPoints')
      .eq('student_id', studentId)
      .not('lessonId', 'eq', 'quiz_game')
      .gt('totalPoints', 0);
    
    if (!results) return false;
    
    const perfectScores = results.filter(r => r.score === r.totalPoints).length;
    return perfectScores >= requiredCount;
  }
  
  async checkSpeedCompletion(studentId, maxSeconds) {
    const { data: results } = await supabase
      .from('results')
      .select('timeTaken')
      .eq('student_id', studentId)
      .not('lessonId', 'eq', 'quiz_game')
      .lte('timeTaken', maxSeconds)
      .limit(1);
    
    return results && results.length > 0;
  }
  
  async checkSubjectMastery(studentId, subject, requiredLessons) {
    const { data: results } = await supabase
      .from('results')
      .select(`
        lessonId,
        lessons!inner (subject)
      `)
      .eq('student_id', studentId)
      .eq('lessons.subject', subject)
      .gte('score', 1);
    
    // Count unique lessons in this subject
    const uniqueLessons = new Set(results?.map(r => r.lessonId) || []).size;
    return uniqueLessons >= requiredLessons;
  }
  
  async checkMultipleSubjects(studentId, requiredSubjects, lessonsPerSubject) {
    const { data: results } = await supabase
      .from('results')
      .select(`
        lessonId,
        lessons!inner (subject)
      `)
      .eq('student_id', studentId)
      .gte('score', 1);
    
    // Group by subject and count unique lessons
    const subjectCounts = {};
    results?.forEach(result => {
      const subject = result.lessons.subject;
      if (!subjectCounts[subject]) {
        subjectCounts[subject] = new Set();
      }
      subjectCounts[subject].add(result.lessonId);
    });
    
    // Count subjects with enough lessons
    const qualifiedSubjects = Object.values(subjectCounts)
      .filter(lessonSet => lessonSet.size >= lessonsPerSubject).length;
    
    return qualifiedSubjects >= requiredSubjects;
  }
  
  async checkTimeOfDayPattern(studentId, timeOfDay) {
    const { data: results } = await supabase
      .from('results')
      .select('timestamp')
      .eq('student_id', studentId)
      .gte('score', 1)
      .limit(20)
      .order('timestamp', { ascending: false });
    
    if (!results || results.length < 10) return false;
    
    let targetCount = 0;
    results.forEach(result => {
      const hour = new Date(result.timestamp).getHours();
      if (timeOfDay === 'morning' && hour >= 6 && hour < 12) {
        targetCount++;
      } else if (timeOfDay === 'night' && (hour >= 22 || hour < 6)) {
        targetCount++;
      }
    });
    
    return (targetCount / results.length) >= 0.7; // 70% of sessions in target time
  }
  
  async checkWeekendActivity(studentId, requiredSessions) {
    const { data: results } = await supabase
      .from('results')
      .select('timestamp')
      .eq('student_id', studentId)
      .gte('score', 1);
    
    if (!results) return false;
    
    const weekendSessions = results.filter(result => {
      const day = new Date(result.timestamp).getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    });
    
    return weekendSessions.length >= requiredSessions;
  }
  
  async checkConsecutiveDays(studentId, requiredDays) {
    const { data: results } = await supabase
      .from('results')
      .select('timestamp')
      .eq('student_id', studentId)
      .gte('score', 1)
      .order('timestamp', { ascending: false });
    
    if (!results || results.length === 0) return false;
    
    // Get unique dates
    const dates = [...new Set(results.map(r => 
      new Date(r.timestamp).toDateString()
    ))].sort((a, b) => new Date(b) - new Date(a));
    
    let consecutiveCount = 1;
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const daysDiff = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        consecutiveCount++;
        if (consecutiveCount >= requiredDays) return true;
      } else {
        break;
      }
    }
    
    return false;
  }
  
  async checkComebackPattern(studentId) {
    // Check if student came back after a break of 7+ days
    const { data: results } = await supabase
      .from('results')
      .select('timestamp')
      .eq('student_id', studentId)
      .gte('score', 1)
      .order('timestamp', { ascending: false })
      .limit(50);
    
    if (!results || results.length < 10) return false;
    
    const dates = results.map(r => new Date(r.timestamp));
    
    // Look for a gap of 7+ days followed by recent activity
    for (let i = 1; i < dates.length - 5; i++) {
      const daysDiff = Math.floor((dates[i - 1] - dates[i]) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 7) {
        // Check if there's recent activity (last 3 days)
        const recentActivity = dates.slice(0, 5).some(date => 
          (new Date() - date) / (1000 * 60 * 60 * 24) <= 3
        );
        return recentActivity;
      }
    }
    
    return false;
  }
  
  async checkImprovementPattern(studentId) {
    // Check if student's recent accuracy is significantly better than earlier
    const { data: results } = await supabase
      .from('results')
      .select('score, totalPoints, timestamp')
      .eq('student_id', studentId)
      .not('lessonId', 'eq', 'quiz_game')
      .gt('totalPoints', 0)
      .order('timestamp', { ascending: true });
    
    if (!results || results.length < 20) return false;
    
    const midpoint = Math.floor(results.length / 2);
    const earlier = results.slice(0, midpoint);
    const recent = results.slice(midpoint);
    
    const earlierAccuracy = earlier.reduce((sum, r) => sum + (r.score / r.totalPoints), 0) / earlier.length;
    const recentAccuracy = recent.reduce((sum, r) => sum + (r.score / r.totalPoints), 0) / recent.length;
    
    return (recentAccuracy - earlierAccuracy) >= 0.15; // 15% improvement
  }
  
  /**
   * Create activity feed entry for achievement
   * @param {number} studentId - Student ID
   * @param {Object} achievement - Achievement object
   */
  async createAchievementActivity(studentId, achievement) {
    try {
      await supabase
        .from('activity_feed')
        .insert({
          student_id: studentId,
          activity_type: 'achievement_earned',
          title: `Earned "${achievement.title}" achievement!`,
          description: achievement.description,
          metadata: {
            achievementId: achievement.id,
            achievementName: achievement.name,
            badgeIcon: achievement.badge_icon,
            xpReward: achievement.xp_reward
          },
          is_public: true,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error creating achievement activity:', error);
    }
  }
}

module.exports = new AchievementService();