const { supabase } = require('../config/database');
const xpService = require('./xpService');

class QuestService {
  /**
   * Generate daily quests for a specific date
   * @param {Date} date - Date to generate quests for
   * @returns {Promise<Array>} Array of generated quests
   */
  async generateDailyQuests(date = new Date()) {
    try {
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Check if quests already exist for this date
      const existingQuests = await this.getDailyQuests(date);
      if (existingQuests.length > 0) {
        return existingQuests;
      }
      
      // Generate new quests for the day
      const questTemplates = this.getQuestTemplates();
      const selectedQuests = this.selectDailyQuests(questTemplates, date);
      
      const createdQuests = [];
      for (const questTemplate of selectedQuests) {
        const quest = await this.createDailyQuest(questTemplate, dateString);
        createdQuests.push(quest);
      }
      
      console.log(`Generated ${createdQuests.length} daily quests for ${dateString}`);
      return createdQuests;
    } catch (error) {
      console.error('Error generating daily quests:', error);
      return [];
    }
  }
  
  /**
   * Get daily quests for a specific date
   * @param {Date} date - Date to get quests for
   * @returns {Promise<Array>} Array of daily quests
   */
  async getDailyQuests(date = new Date()) {
    try {
      const dateString = date.toISOString().split('T')[0];
      
      const { data: quests, error } = await supabase
        .from('daily_quests')
        .select('*')
        .eq('active_date', dateString)
        .eq('is_active', true)
        .order('id');
      
      if (error) throw error;
      return quests || [];
    } catch (error) {
      console.error('Error getting daily quests:', error);
      return [];
    }
  }
  
  /**
   * Get student's quest progress for a specific date
   * @param {number} studentId - Student ID
   * @param {Date} date - Date to get progress for
   * @returns {Promise<Array>} Array of quest progress
   */
  async getStudentQuestProgress(studentId, date = new Date()) {
    try {
      const dateString = date.toISOString().split('T')[0];
      
      const { data: progress, error } = await supabase
        .from('student_quest_progress')
        .select(`
          *,
          daily_quests (*)
        `)
        .eq('student_id', studentId)
        .eq('daily_quests.active_date', dateString)
        .eq('daily_quests.is_active', true);
      
      if (error) throw error;
      return progress || [];
    } catch (error) {
      console.error('Error getting student quest progress:', error);
      return [];
    }
  }
  
  /**
   * Update student's progress on a quest
   * @param {number} studentId - Student ID
   * @param {number} questId - Quest ID
   * @param {number} progressIncrement - Amount to increment progress by
   * @param {Object} metadata - Additional progress metadata
   * @returns {Promise<Object>} Updated progress
   */
  async updateQuestProgress(studentId, questId, progressIncrement = 1, metadata = {}) {
    try {
      // Get or create progress record
      let progressRecord = await this.getOrCreateQuestProgress(studentId, questId);
      if (!progressRecord) return null;
      
      const newProgress = progressRecord.progress + progressIncrement;
      const completed = newProgress >= progressRecord.target_progress;
      
      // Update progress
      const { data: updatedProgress, error } = await supabase
        .from('student_quest_progress')
        .update({
          progress: newProgress,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          metadata: { ...progressRecord.metadata, ...metadata }
        })
        .eq('id', progressRecord.id)
        .select(`
          *,
          daily_quests (*)
        `)
        .single();
      
      if (error) throw error;
      
      // If quest was just completed, award rewards
      if (completed && !progressRecord.completed) {
        await this.awardQuestRewards(studentId, updatedProgress.daily_quests);
      }
      
      return updatedProgress;
    } catch (error) {
      console.error('Error updating quest progress:', error);
      return null;
    }
  }
  
  /**
   * Check and update quest progress based on student activity
   * @param {number} studentId - Student ID
   * @param {string} activityType - Type of activity
   * @param {Object} activityData - Activity data
   * @returns {Promise<Array>} Array of updated quest progress
   */
  async checkAndUpdateQuests(studentId, activityType, activityData = {}) {
    try {
      const today = new Date();
      const dailyQuests = await this.getDailyQuests(today);
      const updatedQuests = [];
      
      for (const quest of dailyQuests) {
        const shouldUpdate = this.shouldUpdateQuest(quest, activityType, activityData);
        if (shouldUpdate) {
          const progressIncrement = this.calculateProgressIncrement(quest, activityData);
          const updatedProgress = await this.updateQuestProgress(
            studentId,
            quest.id,
            progressIncrement,
            { activityType, activityData }
          );
          
          if (updatedProgress) {
            updatedQuests.push(updatedProgress);
          }
        }
      }
      
      return updatedQuests;
    } catch (error) {
      console.error('Error checking quest progress:', error);
      return [];
    }
  }
  
  /**
   * Award rewards for completing a quest
   * @param {number} studentId - Student ID
   * @param {Object} quest - Completed quest
   */
  async awardQuestRewards(studentId, quest) {
    try {
      // Award XP
      if (quest.xp_reward > 0) {
        await xpService.awardXP(
          studentId,
          quest.xp_reward,
          'daily_quest',
          `Completed daily quest: ${quest.title}`,
          { questId: quest.id, questType: quest.quest_type }
        );
      }
      
      // Award streak shield if applicable
      if (quest.streak_shield_reward) {
        // TODO: Implement streak shield reward when streak service has this feature
        console.log(`Quest completed with streak shield reward: ${quest.title}`);
      }
      
      console.log(`Quest rewards awarded for "${quest.title}": ${quest.xp_reward} XP`);
    } catch (error) {
      console.error('Error awarding quest rewards:', error);
    }
  }
  
  /**
   * Get or create quest progress record for a student
   * @param {number} studentId - Student ID
   * @param {number} questId - Quest ID
   * @returns {Promise<Object>} Progress record
   */
  async getOrCreateQuestProgress(studentId, questId) {
    try {
      // Try to get existing progress
      const { data: existing, error: getError } = await supabase
        .from('student_quest_progress')
        .select('*')
        .eq('student_id', studentId)
        .eq('quest_id', questId)
        .maybeSingle();
      
      if (getError) throw getError;
      if (existing) return existing;
      
      // Get quest details to set target progress
      const { data: quest, error: questError } = await supabase
        .from('daily_quests')
        .select('*')
        .eq('id', questId)
        .single();
      
      if (questError) throw questError;
      
      const targetProgress = quest.requirements?.target || 1;
      
      // Create new progress record
      const { data: newProgress, error: createError } = await supabase
        .from('student_quest_progress')
        .insert({
          student_id: studentId,
          quest_id: questId,
          progress: 0,
          target_progress: targetProgress,
          completed: false,
          metadata: {},
          started_at: new Date().toISOString()
        })
        .select('*')
        .single();
      
      if (createError) throw createError;
      return newProgress;
    } catch (error) {
      console.error('Error getting/creating quest progress:', error);
      return null;
    }
  }
  
  /**
   * Create a daily quest
   * @param {Object} questTemplate - Quest template
   * @param {string} dateString - Date string (YYYY-MM-DD)
   * @returns {Promise<Object>} Created quest
   */
  async createDailyQuest(questTemplate, dateString) {
    try {
      const { data: quest, error } = await supabase
        .from('daily_quests')
        .insert({
          quest_type: questTemplate.type,
          title: questTemplate.title,
          description: questTemplate.description,
          requirements: questTemplate.requirements,
          xp_reward: questTemplate.xpReward,
          streak_shield_reward: questTemplate.streakShieldReward || false,
          active_date: dateString,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select('*')
        .single();
      
      if (error) throw error;
      return quest;
    } catch (error) {
      console.error('Error creating daily quest:', error);
      throw error;
    }
  }
  
  /**
   * Get quest templates for generating daily quests
   * @returns {Array} Array of quest templates
   */
  getQuestTemplates() {
    return [
      // Knowledge Quests
      {
        type: 'knowledge',
        title: 'Physics Explorer',
        description: 'Complete 3 physics lessons today',
        requirements: { target: 3, activity: 'lesson_completion' },
        xpReward: 150,
        weight: 3
      },
      {
        type: 'knowledge',
        title: 'Quick Learner',
        description: 'Complete 1 lesson today',
        requirements: { target: 1, activity: 'lesson_completion' },
        xpReward: 50,
        weight: 5
      },
      {
        type: 'knowledge',
        title: 'Subject Specialist',
        description: 'Complete 2 lessons from the same subject',
        requirements: { target: 2, activity: 'same_subject_lessons' },
        xpReward: 100,
        weight: 2
      },
      
      // Accuracy Quests
      {
        type: 'accuracy',
        title: 'Perfect Aim',
        description: 'Achieve 100% accuracy on any lesson',
        requirements: { target: 1, activity: 'perfect_score' },
        xpReward: 200,
        weight: 2
      },
      {
        type: 'accuracy',
        title: 'High Achiever',
        description: 'Maintain 80%+ accuracy across all lessons today',
        requirements: { target: 80, activity: 'daily_accuracy' },
        xpReward: 120,
        weight: 3
      },
      {
        type: 'accuracy',
        title: 'Consistent Performer',
        description: 'Complete 3 lessons with 70%+ accuracy',
        requirements: { target: 3, activity: 'accurate_lessons', minAccuracy: 70 },
        xpReward: 150,
        weight: 3
      },
      
      // Speed Quests
      {
        type: 'speed',
        title: 'Speed Demon',
        description: 'Complete a lesson in under 5 minutes',
        requirements: { target: 1, activity: 'fast_completion', maxTime: 300 },
        xpReward: 100,
        weight: 2
      },
      {
        type: 'speed',
        title: 'Lightning Round',
        description: 'Complete 2 lessons in under 8 minutes each',
        requirements: { target: 2, activity: 'fast_completion', maxTime: 480 },
        xpReward: 180,
        weight: 1
      },
      
      // Consistency Quests
      {
        type: 'consistency',
        title: 'Streak Maintainer',
        description: 'Study today to maintain your learning streak',
        requirements: { target: 1, activity: 'daily_study' },
        xpReward: 75,
        streakShieldReward: true,
        weight: 4
      },
      {
        type: 'consistency',
        title: 'Early Bird',
        description: 'Complete a lesson before 12 PM',
        requirements: { target: 1, activity: 'morning_study' },
        xpReward: 80,
        weight: 2
      },
      {
        type: 'consistency',
        title: 'Night Owl',
        description: 'Study after 8 PM',
        requirements: { target: 1, activity: 'evening_study' },
        xpReward: 80,
        weight: 2
      },
      
      // Challenge Quests
      {
        type: 'challenge',
        title: 'Formula Master',
        description: 'Complete 5 questions correctly in a row',
        requirements: { target: 5, activity: 'consecutive_correct' },
        xpReward: 200,
        weight: 1
      },
      {
        type: 'challenge',
        title: 'Physics Marathon',
        description: 'Study for a total of 30 minutes today',
        requirements: { target: 1800, activity: 'total_study_time' }, // 30 minutes in seconds
        xpReward: 250,
        weight: 1
      },
      {
        type: 'challenge',
        title: 'Mistake Fixer',
        description: 'Review and correct 3 previous mistakes',
        requirements: { target: 3, activity: 'mistake_review' },
        xpReward: 120,
        weight: 1
      }
    ];
  }
  
  /**
   * Select quests for a specific day
   * @param {Array} questTemplates - Available quest templates
   * @param {Date} date - Date to select quests for
   * @returns {Array} Selected quest templates
   */
  selectDailyQuests(questTemplates, date) {
    // Generate 3 daily quests with variety
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    
    // Ensure variety by selecting from different categories
    const categories = ['knowledge', 'accuracy', 'speed', 'consistency', 'challenge'];
    const selectedQuests = [];
    
    // Always include one knowledge quest
    const knowledgeQuests = questTemplates.filter(q => q.type === 'knowledge');
    if (knowledgeQuests.length > 0) {
      const randomKnowledge = knowledgeQuests[dayOfMonth % knowledgeQuests.length];
      selectedQuests.push(randomKnowledge);
    }
    
    // Always include one consistency quest
    const consistencyQuests = questTemplates.filter(q => q.type === 'consistency');
    if (consistencyQuests.length > 0) {
      const randomConsistency = consistencyQuests[dayOfWeek % consistencyQuests.length];
      selectedQuests.push(randomConsistency);
    }
    
    // Add one more quest from remaining categories
    const remainingCategories = ['accuracy', 'speed', 'challenge'];
    const remainingQuests = questTemplates.filter(q => 
      remainingCategories.includes(q.type) && 
      !selectedQuests.includes(q)
    );
    
    if (remainingQuests.length > 0) {
      const randomRemaining = remainingQuests[(dayOfWeek + dayOfMonth) % remainingQuests.length];
      selectedQuests.push(randomRemaining);
    }
    
    return selectedQuests;
  }
  
  /**
   * Check if a quest should be updated based on activity
   * @param {Object} quest - Quest object
   * @param {string} activityType - Activity type
   * @param {Object} activityData - Activity data
   * @returns {boolean} Whether quest should be updated
   */
  shouldUpdateQuest(quest, activityType, activityData) {
    const requirements = quest.requirements;
    
    switch (requirements.activity) {
      case 'lesson_completion':
        return activityType === 'lesson_completion';
        
      case 'perfect_score':
        return activityType === 'lesson_completion' && 
               activityData.accuracy === 100;
        
      case 'fast_completion':
        return activityType === 'lesson_completion' && 
               activityData.timeTaken <= requirements.maxTime;
        
      case 'accurate_lessons':
        return activityType === 'lesson_completion' && 
               activityData.accuracy >= (requirements.minAccuracy || 70);
        
      case 'daily_study':
        return activityType === 'lesson_completion';
        
      case 'morning_study':
        return activityType === 'lesson_completion' && 
               new Date().getHours() < 12;
        
      case 'evening_study':
        return activityType === 'lesson_completion' && 
               new Date().getHours() >= 20;
        
      case 'same_subject_lessons':
        return activityType === 'lesson_completion';
        
      default:
        return false;
    }
  }
  
  /**
   * Calculate progress increment for a quest
   * @param {Object} quest - Quest object
   * @param {Object} activityData - Activity data
   * @returns {number} Progress increment
   */
  calculateProgressIncrement(quest, activityData) {
    const requirements = quest.requirements;
    
    switch (requirements.activity) {
      case 'total_study_time':
        return activityData.timeTaken || 0; // Add actual time spent
        
      case 'consecutive_correct':
        // This would need special handling in the quiz system
        return activityData.consecutiveCorrect || 0;
        
      default:
        return 1; // Most quests increment by 1
    }
  }
  
  /**
   * Get quest completion statistics
   * @param {Date} startDate - Start date for statistics
   * @param {Date} endDate - End date for statistics
   * @returns {Promise<Object>} Quest statistics
   */
  async getQuestStatistics(startDate, endDate) {
    try {
      const { data: questData, error } = await supabase
        .from('student_quest_progress')
        .select(`
          completed,
          daily_quests (quest_type, xp_reward),
          students (id)
        `)
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString());
      
      if (error) throw error;
      
      const stats = {
        totalQuests: questData.length,
        completedQuests: questData.filter(q => q.completed).length,
        completionRate: 0,
        totalXPAwarded: 0,
        questsByType: {},
        uniqueParticipants: new Set(questData.map(q => q.students.id)).size
      };
      
      if (stats.totalQuests > 0) {
        stats.completionRate = Math.round((stats.completedQuests / stats.totalQuests) * 100);
      }
      
      // Calculate XP awarded and group by type
      questData.forEach(quest => {
        const questType = quest.daily_quests.quest_type;
        if (!stats.questsByType[questType]) {
          stats.questsByType[questType] = { total: 0, completed: 0 };
        }
        
        stats.questsByType[questType].total++;
        if (quest.completed) {
          stats.questsByType[questType].completed++;
          stats.totalXPAwarded += quest.daily_quests.xp_reward;
        }
      });
      
      return stats;
    } catch (error) {
      console.error('Error getting quest statistics:', error);
      return {
        totalQuests: 0,
        completedQuests: 0,
        completionRate: 0,
        totalXPAwarded: 0,
        questsByType: {},
        uniqueParticipants: 0
      };
    }
  }
}

module.exports = new QuestService();