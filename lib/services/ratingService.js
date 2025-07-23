const { RATING_CONFIG } = require('../config/constants');
const databaseService = require('./databaseService');

class RatingService {
  // Calculate rating change using ELO-like algorithm
  calculateRatingChange(previousRating, performance, timeTaken, streak) {
    // Base K-factor (sensitivity of rating changes)
    const baseK = RATING_CONFIG.BASE_K_FACTOR;
    
    // Time bonus (faster completion = higher bonus)
    const timeBonus = Math.max(0, 1 - (timeTaken / RATING_CONFIG.MAX_TIME_BONUS));
    
    // Streak multiplier
    const streakMultiplier = 1 + (Math.min(streak, RATING_CONFIG.MAX_STREAK_MULTIPLIER) * RATING_CONFIG.STREAK_BONUS_RATE);
    
    // Performance factor (0-1)
    const performanceFactor = performance;
    
    // Calculate expected score (ELO formula)
    const expectedScore = 1 / (1 + Math.pow(10, (1500 - previousRating) / 400));
    
    // Calculate rating change
    const ratingChange = baseK * (performanceFactor - expectedScore) * timeBonus * streakMultiplier;
    
    return Math.round(ratingChange);
  }

  // Update student rating after lesson completion
  async updateStudentRating(studentId, lessonId, score, totalPoints, timeTaken, streak) {
    try {
      // Get current rating
      const currentRating = await databaseService.getStudentRating(studentId);
      const previousRating = currentRating?.rating || RATING_CONFIG.DEFAULT_RATING;
      const performance = score / totalPoints;
      
      // Calculate new rating
      const ratingChange = this.calculateRatingChange(previousRating, performance, timeTaken, streak);
      const newRating = previousRating + ratingChange;

      // Update or insert rating
      await databaseService.upsertRating({
        student_id: studentId,
        rating: newRating,
        last_updated: new Date().toISOString()
      });

      // Record rating history
      await databaseService.createRatingHistory({
        student_id: studentId,
        lesson_id: lessonId,
        previous_rating: previousRating,
        rating_change: ratingChange,
        new_rating: newRating,
        performance: performance,
        time_taken: timeTaken,
        streak: streak,
        timestamp: new Date().toISOString()
      });

      return { newRating, ratingChange, previousRating };
    } catch (error) {
      console.error('Error updating student rating:', error);
      throw error;
    }
  }

  // Get leaderboard data
  async getLeaderboard(limit = 100, offset = 0, filter = 'all') {
    try {
      const ratings = await databaseService.getRatingsWithChanges(limit, offset, filter);
      return ratings;
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  }

  // Get student rating with history
  async getStudentRatingData(studentId) {
    try {
      const rating = await databaseService.getStudentRating(studentId);
      const history = await databaseService.getStudentRatingHistory(studentId);
      
      return {
        currentRating: rating,
        history: history
      };
    } catch (error) {
      console.error('Error fetching student rating data:', error);
      throw error;
    }
  }

  // Calculate performance metrics
  calculatePerformanceMetrics(score, totalPoints, timeTaken, streak) {
    const accuracy = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
    const timeEfficiency = timeTaken > 0 ? Math.max(0, 1 - (timeTaken / RATING_CONFIG.MAX_TIME_BONUS)) : 0;
    const streakBonus = Math.min(streak, RATING_CONFIG.MAX_STREAK_MULTIPLIER) * RATING_CONFIG.STREAK_BONUS_RATE;
    
    return {
      accuracy: Math.round(accuracy * 100) / 100,
      timeEfficiency: Math.round(timeEfficiency * 100) / 100,
      streakBonus: Math.round(streakBonus * 100) / 100,
      overallPerformance: accuracy / 100
    };
  }

  // Get rating statistics
  async getRatingStatistics() {
    try {
      const allRatings = await databaseService.getRatings(1000); // Get more for statistics
      
      if (!allRatings || allRatings.length === 0) {
        return {
          totalPlayers: 0,
          averageRating: RATING_CONFIG.DEFAULT_RATING,
          highestRating: RATING_CONFIG.DEFAULT_RATING,
          lowestRating: RATING_CONFIG.DEFAULT_RATING,
          ratingDistribution: []
        };
      }

      const ratings = allRatings.map(r => r.rating);
      const totalPlayers = ratings.length;
      const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / totalPlayers;
      const highestRating = Math.max(...ratings);
      const lowestRating = Math.min(...ratings);

      // Create rating distribution (ranges of 100 points)
      const distribution = {};
      ratings.forEach(rating => {
        const range = Math.floor(rating / 100) * 100;
        const rangeKey = `${range}-${range + 99}`;
        distribution[rangeKey] = (distribution[rangeKey] || 0) + 1;
      });

      return {
        totalPlayers,
        averageRating: Math.round(averageRating),
        highestRating,
        lowestRating,
        ratingDistribution: Object.entries(distribution).map(([range, count]) => ({
          range,
          count,
          percentage: Math.round((count / totalPlayers) * 100)
        }))
      };
    } catch (error) {
      console.error('Error calculating rating statistics:', error);
      throw error;
    }
  }

  // Validate rating data
  validateRatingData(score, totalPoints, timeTaken, streak) {
    const errors = [];

    if (typeof score !== 'number' || score < 0) {
      errors.push('Invalid score value');
    }

    if (typeof totalPoints !== 'number' || totalPoints <= 0) {
      errors.push('Invalid total points value');
    }

    if (score > totalPoints) {
      errors.push('Score cannot be greater than total points');
    }

    if (typeof timeTaken !== 'number' || timeTaken < 0) {
      errors.push('Invalid time taken value');
    }

    if (typeof streak !== 'number' || streak < 0) {
      errors.push('Invalid streak value');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get rating tier/rank
  getRatingTier(rating) {
    if (rating >= 2000) return { tier: 'Master', color: '#ff6b6b' };
    if (rating >= 1800) return { tier: 'Diamond', color: '#4ecdc4' };
    if (rating >= 1600) return { tier: 'Platinum', color: '#45b7d1' };
    if (rating >= 1400) return { tier: 'Gold', color: '#f9ca24' };
    if (rating >= 1200) return { tier: 'Silver', color: '#a4b0be' };
    return { tier: 'Bronze', color: '#cd6133' };
  }
}

module.exports = new RatingService();
