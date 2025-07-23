const ratingService = require('../services/ratingService');
const databaseService = require('../services/databaseService');
const sessionService = require('../services/sessionService');
const { asyncHandler, AuthorizationError, ValidationError } = require('../middleware/errorHandler');

class RatingController {
  // Get ratings with pagination and filtering
  getRatings = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, filter = 'all' } = req.query;

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get ratings with the filter applied
    const ratings = await ratingService.getLeaderboard(parseInt(limit), offset, filter);

    // Add tier information to each rating
    const ratingsWithTiers = ratings.map(rating => ({
      ...rating,
      tier: ratingService.getRatingTier(rating.rating)
    }));

    res.json({
      success: true,
      ratings: ratingsWithTiers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: ratings.length === parseInt(limit)
      },
      count: ratingsWithTiers.length
    });
  });

  // Get leaderboard
  getLeaderboard = asyncHandler(async (req, res) => {
    const { limit = 100 } = req.query;

    const leaderboard = await ratingService.getLeaderboard(parseInt(limit));

    // Add tier information to each rating
    const leaderboardWithTiers = leaderboard.map(rating => ({
      ...rating,
      tier: ratingService.getRatingTier(rating.rating)
    }));

    res.json({
      success: true,
      leaderboard: leaderboardWithTiers,
      count: leaderboardWithTiers.length
    });
  });

  // Get student rating
  getStudentRating = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sessionData = sessionService.getSessionData(req);
    
    // Check if admin or student accessing their own rating
    if (!sessionData.isAuthenticated && sessionData.studentId !== studentId) {
      throw new AuthorizationError('Can only access own rating');
    }
    
    const ratingData = await ratingService.getStudentRatingData(studentId);
    
    // Add tier information
    const currentRating = ratingData.currentRating?.rating || 1500;
    const tier = ratingService.getRatingTier(currentRating);
    
    res.json({
      success: true,
      rating: {
        ...ratingData.currentRating,
        tier
      },
      history: ratingData.history
    });
  });

  // Update student rating (internal use, called after lesson completion)
  updateStudentRating = asyncHandler(async (req, res) => {
    const { studentId, lessonId, score, totalPoints, timeTaken, streak } = req.body;
    
    // Validate input data
    const validation = ratingService.validateRatingData(score, totalPoints, timeTaken, streak);
    if (!validation.isValid) {
      throw new ValidationError('Invalid rating data', validation.errors);
    }
    
    const result = await ratingService.updateStudentRating(
      studentId, 
      lessonId, 
      score, 
      totalPoints, 
      timeTaken, 
      streak
    );
    
    // Add tier information
    const newTier = ratingService.getRatingTier(result.newRating);
    const previousTier = ratingService.getRatingTier(result.previousRating);
    
    res.json({
      success: true,
      rating: {
        previous: result.previousRating,
        new: result.newRating,
        change: result.ratingChange,
        previousTier,
        newTier,
        tierChanged: newTier.tier !== previousTier.tier
      }
    });
  });

  // Get rating statistics
  getRatingStatistics = asyncHandler(async (req, res) => {
    const statistics = await ratingService.getRatingStatistics();
    
    res.json({
      success: true,
      statistics
    });
  });

  // Get student rating history
  getStudentRatingHistory = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { limit = 50 } = req.query;
    const sessionData = sessionService.getSessionData(req);
    
    // Check if admin or student accessing their own history
    if (!sessionData.isAuthenticated && sessionData.studentId !== studentId) {
      throw new AuthorizationError('Can only access own rating history');
    }
    
    const history = await databaseService.getStudentRatingHistory(studentId, parseInt(limit));
    
    res.json({
      success: true,
      history,
      count: history.length
    });
  });

  // Calculate performance metrics
  calculatePerformanceMetrics = asyncHandler(async (req, res) => {
    const { score, totalPoints, timeTaken, streak } = req.body;
    
    // Validate input data
    const validation = ratingService.validateRatingData(score, totalPoints, timeTaken, streak);
    if (!validation.isValid) {
      throw new ValidationError('Invalid performance data', validation.errors);
    }
    
    const metrics = ratingService.calculatePerformanceMetrics(score, totalPoints, timeTaken, streak);
    
    res.json({
      success: true,
      metrics
    });
  });

  // Get rating tier information
  getRatingTier = asyncHandler(async (req, res) => {
    const { rating } = req.query;
    
    if (!rating || isNaN(rating)) {
      throw new ValidationError('Valid rating value is required');
    }
    
    const tier = ratingService.getRatingTier(parseInt(rating));
    
    res.json({
      success: true,
      tier
    });
  });

  // Get all rating tiers
  getAllRatingTiers = asyncHandler(async (req, res) => {
    const tiers = [
      { tier: 'Bronze', minRating: 0, maxRating: 1199, color: '#cd6133' },
      { tier: 'Silver', minRating: 1200, maxRating: 1399, color: '#a4b0be' },
      { tier: 'Gold', minRating: 1400, maxRating: 1599, color: '#f9ca24' },
      { tier: 'Platinum', minRating: 1600, maxRating: 1799, color: '#45b7d1' },
      { tier: 'Diamond', minRating: 1800, maxRating: 1999, color: '#4ecdc4' },
      { tier: 'Master', minRating: 2000, maxRating: null, color: '#ff6b6b' }
    ];
    
    res.json({
      success: true,
      tiers
    });
  });

  // Reset student rating (admin only)
  resetStudentRating = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { newRating = 1500 } = req.body;
    
    if (typeof newRating !== 'number' || newRating < 0) {
      throw new ValidationError('Valid rating value is required');
    }
    
    await databaseService.upsertRating({
      student_id: studentId,
      rating: newRating,
      last_updated: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Student rating reset successfully',
      newRating
    });
  });

  // Get top performers
  getTopPerformers = asyncHandler(async (req, res) => {
    const { limit = 10, timeframe = 'all' } = req.query;
    
    // For now, just return top rated students
    // This could be enhanced to filter by timeframe
    const topPerformers = await ratingService.getLeaderboard(parseInt(limit));
    
    res.json({
      success: true,
      topPerformers,
      timeframe,
      count: topPerformers.length
    });
  });

  // Get rating distribution
  getRatingDistribution = asyncHandler(async (req, res) => {
    const statistics = await ratingService.getRatingStatistics();
    
    res.json({
      success: true,
      distribution: statistics.ratingDistribution,
      totalPlayers: statistics.totalPlayers
    });
  });

  // Simulate rating change (for preview)
  simulateRatingChange = asyncHandler(async (req, res) => {
    const { currentRating, score, totalPoints, timeTaken, streak } = req.body;
    
    // Validate input data
    const validation = ratingService.validateRatingData(score, totalPoints, timeTaken, streak);
    if (!validation.isValid) {
      throw new ValidationError('Invalid simulation data', validation.errors);
    }
    
    if (typeof currentRating !== 'number') {
      throw new ValidationError('Current rating must be a number');
    }
    
    const performance = score / totalPoints;
    const ratingChange = ratingService.calculateRatingChange(currentRating, performance, timeTaken, streak);
    const newRating = currentRating + ratingChange;
    
    const currentTier = ratingService.getRatingTier(currentRating);
    const newTier = ratingService.getRatingTier(newRating);
    
    res.json({
      success: true,
      simulation: {
        currentRating,
        ratingChange,
        newRating,
        currentTier,
        newTier,
        tierChanged: newTier.tier !== currentTier.tier
      }
    });
  });
}

module.exports = new RatingController();
