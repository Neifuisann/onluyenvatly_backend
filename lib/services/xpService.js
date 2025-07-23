const { supabase } = require('../config/database');

class XPService {
  /**
   * Award XP to a student
   * @param {number} studentId - Student ID
   * @param {number} xpAmount - Amount of XP to award
   * @param {string} transactionType - Type of transaction ('lesson_completion', 'streak_bonus', etc.)
   * @param {string} description - Description of why XP was awarded
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Updated XP information
   */
  async awardXP(studentId, xpAmount, transactionType, description, metadata = {}) {
    try {
      // Get or create student XP record
      let xpRecord = await this.getXPRecord(studentId);
      if (!xpRecord) {
        xpRecord = await this.createXPRecord(studentId);
      }
      
      const newTotalXP = xpRecord.total_xp + xpAmount;
      const levelInfo = this.calculateLevel(newTotalXP);
      
      // Check if student leveled up
      const leveledUp = levelInfo.currentLevel > xpRecord.current_level;
      
      // Update XP record
      const { data: updatedXP, error: updateError } = await supabase
        .from('student_xp')
        .update({
          total_xp: newTotalXP,
          current_level: levelInfo.currentLevel,
          xp_to_next_level: levelInfo.xpToNextLevel,
          updated_at: new Date().toISOString()
        })
        .eq('student_id', studentId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      // Record XP transaction
      await this.recordXPTransaction(
        studentId,
        xpAmount,
        transactionType,
        description,
        {
          ...metadata,
          previousLevel: xpRecord.current_level,
          newLevel: levelInfo.currentLevel,
          leveledUp
        }
      );
      
      // If student leveled up, award bonus XP and possibly create achievement
      if (leveledUp) {
        await this.handleLevelUp(studentId, levelInfo.currentLevel, xpRecord.current_level);
      }
      
      // Update weekly league XP (if applicable)
      try {
        const leagueService = require('./leagueService');
        await leagueService.updateStudentWeeklyXP(studentId, xpAmount);
      } catch (error) {
        console.error('Error updating league XP:', error);
        // Don't throw error - league system is optional
      }
      
      return {
        success: true,
        xpAwarded: xpAmount,
        totalXP: newTotalXP,
        currentLevel: levelInfo.currentLevel,
        xpToNextLevel: levelInfo.xpToNextLevel,
        leveledUp,
        levelUpBonus: leveledUp ? this.getLevelUpBonus(levelInfo.currentLevel) : 0
      };
    } catch (error) {
      console.error('Error awarding XP:', error);
      throw error;
    }
  }
  
  /**
   * Get XP record for a student
   * @param {number} studentId - Student ID
   * @returns {Promise<Object|null>} XP record or null
   */
  async getXPRecord(studentId) {
    try {
      const { data: xpRecord, error } = await supabase
        .from('student_xp')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();
      
      if (error) throw error;
      return xpRecord;
    } catch (error) {
      console.error('Error getting XP record:', error);
      throw error;
    }
  }
  
  /**
   * Create initial XP record for a student
   * @param {number} studentId - Student ID
   * @returns {Promise<Object>} Created XP record
   */
  async createXPRecord(studentId) {
    try {
      const { data: newXP, error } = await supabase
        .from('student_xp')
        .insert({
          student_id: studentId,
          total_xp: 0,
          current_level: 1,
          xp_to_next_level: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return newXP;
    } catch (error) {
      console.error('Error creating XP record:', error);
      throw error;
    }
  }
  
  /**
   * Record XP transaction in history
   * @param {number} studentId - Student ID
   * @param {number} xpAmount - XP amount (can be negative)
   * @param {string} transactionType - Type of transaction
   * @param {string} description - Description
   * @param {Object} metadata - Additional data
   */
  async recordXPTransaction(studentId, xpAmount, transactionType, description, metadata = {}) {
    try {
      const { error } = await supabase
        .from('xp_transactions')
        .insert({
          student_id: studentId,
          xp_amount: xpAmount,
          transaction_type: transactionType,
          description: description,
          metadata: metadata,
          lesson_id: metadata.lessonId || null,
          result_id: metadata.resultId || null,
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error recording XP transaction:', error);
      throw error;
    }
  }
  
  /**
   * Calculate level and XP requirements
   * @param {number} totalXP - Total XP earned
   * @returns {Object} Level information
   */
  calculateLevel(totalXP) {
    // Physics-themed level progression
    // Level 1: 0-99 XP (100 XP needed)
    // Level 2: 100-249 XP (150 XP needed)
    // Level 3: 250-449 XP (200 XP needed)
    // And so on with increasing requirements
    
    let currentLevel = 1;
    let xpForCurrentLevel = 0;
    let xpRequiredForLevel = 100;
    
    while (totalXP >= xpForCurrentLevel + xpRequiredForLevel) {
      xpForCurrentLevel += xpRequiredForLevel;
      currentLevel++;
      xpRequiredForLevel = this.getXPRequiredForLevel(currentLevel);
    }
    
    const xpInCurrentLevel = totalXP - xpForCurrentLevel;
    const xpToNextLevel = xpRequiredForLevel - xpInCurrentLevel;
    
    return {
      currentLevel,
      xpInCurrentLevel,
      xpToNextLevel,
      totalXPForCurrentLevel: xpForCurrentLevel,
      xpRequiredForNextLevel: xpRequiredForLevel
    };
  }
  
  /**
   * Get XP required for a specific level
   * @param {number} level - Target level
   * @returns {number} XP required
   */
  getXPRequiredForLevel(level) {
    if (level <= 1) return 100;
    
    // Progressive XP requirements
    const baseXP = 100;
    const multiplier = 1.2;
    const additionalXP = Math.floor(level * 25);
    
    return Math.floor(baseXP * Math.pow(multiplier, level - 1)) + additionalXP;
  }
  
  /**
   * Get physics-themed level titles
   * @param {number} level - Student level
   * @returns {Object} Level title and description
   */
  getLevelTitle(level) {
    const titles = [
      { title: 'Physics Student', description: 'Just starting your physics journey', icon: '🎓' },
      { title: 'Lab Assistant', description: 'Learning the basics', icon: '🔬' },
      { title: 'Physics Explorer', description: 'Discovering new concepts', icon: '🔍' },
      { title: 'Formula Learner', description: 'Mastering equations', icon: '📝' },
      { title: 'Experiment Helper', description: 'Understanding experiments', icon: '⚗️' },
      { title: 'Physics Scholar', description: 'Developing deep knowledge', icon: '📚' },
      { title: 'Theory Understander', description: 'Grasping complex theories', icon: '💡' },
      { title: 'Lab Specialist', description: 'Excelling in practical work', icon: '🧪' },
      { title: 'Physics Enthusiast', description: 'Passionate about physics', icon: '🌟' },
      { title: 'Advanced Student', description: 'Tackling advanced topics', icon: '🚀' },
      { title: 'Newton\'s Apprentice', description: 'Following in great footsteps', icon: '🍎' },
      { title: 'Equation Master', description: 'Fluent in mathematical physics', icon: '🧮' },
      { title: 'Wave Specialist', description: 'Expert in wave phenomena', icon: '🌊' },
      { title: 'Quantum Explorer', description: 'Venturing into quantum realm', icon: '⚛️' },
      { title: 'Energy Expert', description: 'Master of energy concepts', icon: '⚡' },
      { title: 'Field Theorist', description: 'Understanding force fields', icon: '🧲' },
      { title: 'Relativity Student', description: 'Grasping space and time', icon: '🌌' },
      { title: 'Particle Physicist', description: 'Studying fundamental particles', icon: '💫' },
      { title: 'Einstein\'s Protégé', description: 'Following the master', icon: '🧠' },
      { title: 'Cosmic Thinker', description: 'Understanding the universe', icon: '🌠' },
      { title: 'Physics Virtuoso', description: 'Exceptional physics skills', icon: '🎭' },
      { title: 'Quantum Master', description: 'Master of quantum mechanics', icon: '🔮' },
      { title: 'Universal Scholar', description: 'Scholar of universal laws', icon: '🌍' },
      { title: 'Physics Genius', description: 'Exceptional understanding', icon: '🤯' },
      { title: 'Legendary Physicist', description: 'Among the physics legends', icon: '👑' }
    ];
    
    const index = Math.min(level - 1, titles.length - 1);
    return titles[index] || titles[titles.length - 1];
  }
  
  /**
   * Get level up bonus XP
   * @param {number} newLevel - New level achieved
   * @returns {number} Bonus XP amount
   */
  getLevelUpBonus(newLevel) {
    return Math.floor(newLevel * 50); // 50 XP per level as bonus
  }
  
  /**
   * Handle level up events
   * @param {number} studentId - Student ID
   * @param {number} newLevel - New level
   * @param {number} oldLevel - Previous level
   */
  async handleLevelUp(studentId, newLevel, oldLevel) {
    try {
      const bonusXP = this.getLevelUpBonus(newLevel);
      const levelTitle = this.getLevelTitle(newLevel);
      
      // Award level up bonus
      await this.recordXPTransaction(
        studentId,
        bonusXP,
        'level_up_bonus',
        `Level up bonus for reaching level ${newLevel}`,
        {
          newLevel,
          oldLevel,
          levelTitle: levelTitle.title
        }
      );
      
      // Create activity feed entry for level up
      try {
        const xpRecord = await this.getXPRecord(studentId);
        // Use lazy loading to avoid circular dependency
        const activityService = require('./activityService');
        await activityService.logLevelUp(studentId, newLevel, levelTitle.title, xpRecord.total_xp);
      } catch (error) {
        console.error('Error logging level up activity:', error);
      }
      
      console.log(`Student ${studentId} leveled up from ${oldLevel} to ${newLevel}: ${levelTitle.title}`);
    } catch (error) {
      console.error('Error handling level up:', error);
    }
  }
  
  /**
   * Get XP leaderboard
   * @param {string} period - 'all_time', 'monthly', 'weekly'
   * @param {number} limit - Number of entries to return
   * @returns {Promise<Array>} Leaderboard data
   */
  async getXPLeaderboard(period = 'all_time', limit = 50) {
    try {
      let query = supabase
        .from('student_xp')
        .select(`
          student_id,
          total_xp,
          current_level,
          updated_at,
          students ( full_name )
        `)
        .order('total_xp', { ascending: false })
        .limit(limit);
      
      // For period-based leaderboards, we'd need to calculate XP gained in that period
      // This is a simplified version showing all-time leaderboard
      
      const { data: leaderboard, error } = await query;
      if (error) throw error;
      
      return leaderboard?.map((entry, index) => ({
        rank: index + 1,
        studentId: entry.student_id,
        studentName: entry.students?.full_name || 'Unknown Student',
        totalXP: entry.total_xp,
        currentLevel: entry.current_level,
        levelTitle: this.getLevelTitle(entry.current_level),
        lastUpdated: entry.updated_at
      })) || [];
    } catch (error) {
      console.error('Error getting XP leaderboard:', error);
      return [];
    }
  }
  
  /**
   * Get XP statistics for a student
   * @param {number} studentId - Student ID
   * @returns {Promise<Object>} XP statistics
   */
  async getStudentXPStats(studentId) {
    try {
      const xpRecord = await this.getXPRecord(studentId);
      if (!xpRecord) {
        return {
          totalXP: 0,
          currentLevel: 1,
          xpToNextLevel: 100,
          levelTitle: this.getLevelTitle(1),
          levelProgress: 0,
          rank: null
        };
      }
      
      const levelInfo = this.calculateLevel(xpRecord.total_xp);
      const levelTitle = this.getLevelTitle(levelInfo.currentLevel);
      
      // Calculate progress percentage for current level
      const levelProgress = Math.round(
        (levelInfo.xpInCurrentLevel / levelInfo.xpRequiredForNextLevel) * 100
      );
      
      // Get student's rank
      const { count: rank } = await supabase
        .from('student_xp')
        .select('*', { count: 'exact', head: true })
        .gt('total_xp', xpRecord.total_xp);
      
      return {
        totalXP: xpRecord.total_xp,
        currentLevel: levelInfo.currentLevel,
        xpInCurrentLevel: levelInfo.xpInCurrentLevel,
        xpToNextLevel: levelInfo.xpToNextLevel,
        xpRequiredForNextLevel: levelInfo.xpRequiredForNextLevel,
        levelTitle,
        levelProgress,
        rank: (rank || 0) + 1
      };
    } catch (error) {
      console.error('Error getting student XP stats:', error);
      return {
        totalXP: 0,
        currentLevel: 1,
        xpToNextLevel: 100,
        levelTitle: this.getLevelTitle(1),
        levelProgress: 0,
        rank: null
      };
    }
  }
  
  /**
   * Get XP transaction history for a student
   * @param {number} studentId - Student ID
   * @param {number} limit - Number of transactions to return
   * @returns {Promise<Array>} Transaction history
   */
  async getXPTransactionHistory(studentId, limit = 50) {
    try {
      const { data: transactions, error } = await supabase
        .from('xp_transactions')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return transactions?.map(transaction => ({
        id: transaction.id,
        xpAmount: transaction.xp_amount,
        transactionType: transaction.transaction_type,
        description: transaction.description,
        metadata: transaction.metadata,
        createdAt: transaction.created_at,
        lessonId: transaction.lesson_id,
        resultId: transaction.result_id
      })) || [];
    } catch (error) {
      console.error('Error getting XP transaction history:', error);
      return [];
    }
  }
  
  /**
   * Award XP for lesson completion
   * @param {number} studentId - Student ID
   * @param {string} lessonId - Lesson ID
   * @param {number} score - Score achieved
   * @param {number} totalPoints - Total possible points
   * @param {number} timeTaken - Time taken in seconds
   * @param {string} resultId - Result ID
   * @returns {Promise<Object>} XP award result
   */
  async awardLessonCompletionXP(studentId, lessonId, score, totalPoints, timeTaken, resultId) {
    try {
      // Base XP for lesson completion
      let baseXP = 50;
      
      // Accuracy bonus (up to 50% bonus for perfect score)
      const accuracy = totalPoints > 0 ? (score / totalPoints) : 0;
      const accuracyBonus = Math.floor(baseXP * accuracy * 0.5);
      
      // Speed bonus (bonus for completing quickly, up to 25% bonus)
      const speedBonus = this.calculateSpeedBonus(baseXP, timeTaken);
      
      // Perfect score bonus
      const perfectBonus = accuracy === 1 ? 25 : 0;
      
      const totalXP = baseXP + accuracyBonus + speedBonus + perfectBonus;
      
      const description = `Completed lesson with ${Math.round(accuracy * 100)}% accuracy`;
      const metadata = {
        lessonId,
        resultId,
        score,
        totalPoints,
        accuracy: Math.round(accuracy * 100),
        timeTaken,
        baseXP,
        accuracyBonus,
        speedBonus,
        perfectBonus
      };
      
      return await this.awardXP(
        studentId,
        totalXP,
        'lesson_completion',
        description,
        metadata
      );
    } catch (error) {
      console.error('Error awarding lesson completion XP:', error);
      throw error;
    }
  }
  
  /**
   * Calculate speed bonus based on time taken
   * @param {number} baseXP - Base XP amount
   * @param {number} timeTaken - Time taken in seconds
   * @returns {number} Speed bonus XP
   */
  calculateSpeedBonus(baseXP, timeTaken) {
    // Speed bonus for completing lesson quickly
    // 5 minutes = full bonus, 15 minutes = no bonus
    const maxBonusTime = 5 * 60; // 5 minutes
    const noBonusTime = 15 * 60; // 15 minutes
    
    if (timeTaken <= maxBonusTime) {
      return Math.floor(baseXP * 0.25); // 25% bonus
    } else if (timeTaken <= noBonusTime) {
      const ratio = (noBonusTime - timeTaken) / (noBonusTime - maxBonusTime);
      return Math.floor(baseXP * 0.25 * ratio);
    }
    
    return 0; // No bonus for slow completion
  }
  
  /**
   * Award XP for daily streak milestones
   * @param {number} studentId - Student ID
   * @param {number} streakDays - Current streak days
   * @returns {Promise<Object>} XP award result
   */
  async awardStreakMilestoneXP(studentId, streakDays) {
    try {
      let xpAmount = 0;
      let description = '';
      
      // Award XP for specific streak milestones
      switch (streakDays) {
        case 3:
          xpAmount = 100;
          description = 'Achieved 3-day learning streak!';
          break;
        case 7:
          xpAmount = 200;
          description = 'Achieved 7-day learning streak!';
          break;
        case 14:
          xpAmount = 300;
          description = 'Achieved 14-day learning streak!';
          break;
        case 30:
          xpAmount = 500;
          description = 'Achieved 30-day learning streak!';
          break;
        case 50:
          xpAmount = 750;
          description = 'Achieved 50-day learning streak!';
          break;
        case 100:
          xpAmount = 1000;
          description = 'Achieved 100-day learning streak!';
          break;
        case 365:
          xpAmount = 2000;
          description = 'Achieved 365-day learning streak!';
          break;
        default:
          return null; // No XP for this streak milestone
      }
      
      if (xpAmount > 0) {
        return await this.awardXP(
          studentId,
          xpAmount,
          'streak_milestone',
          description,
          { streakDays, milestone: true }
        );
      }
      
      return null;
    } catch (error) {
      console.error('Error awarding streak milestone XP:', error);
      throw error;
    }
  }
}

module.exports = new XPService();