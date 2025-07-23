const express = require('express');
const router = express.Router();
const leagueService = require('../lib/services/leagueService');
const { asyncHandler } = require('../lib/middleware/errorHandler');
const { requireStudentAuth, requireAdminAuth } = require('../lib/middleware/auth');

/**
 * @route GET /api/leagues/current-season
 * @desc Get current active league season
 * @access Public
 */
router.get('/current-season', asyncHandler(async (req, res) => {
  const currentSeason = await leagueService.getCurrentSeason();
  
  res.json({
    success: true,
    data: { season: currentSeason }
  });
}));

/**
 * @route GET /api/leagues/divisions
 * @desc Get all league divisions
 * @access Public
 */
router.get('/divisions', asyncHandler(async (req, res) => {
  const divisions = await leagueService.getDivisions();
  
  res.json({
    success: true,
    data: { divisions }
  });
}));

/**
 * @route POST /api/leagues/join
 * @desc Join current league season
 * @access Private (Student)
 */
router.post('/join', requireStudentAuth, asyncHandler(async (req, res) => {
  const studentId = req.session.studentId;
  
  const participation = await leagueService.joinCurrentSeason(studentId);
  
  res.json({
    success: true,
    data: { participation },
    message: `Joined ${participation.league_divisions.name} successfully!`
  });
}));

/**
 * @route GET /api/leagues/my-participation
 * @desc Get current student's league participation
 * @access Private (Student)
 */
router.get('/my-participation', requireStudentAuth, asyncHandler(async (req, res) => {
  const studentId = req.session.studentId;
  const currentSeason = await leagueService.getCurrentSeason();
  
  const participation = await leagueService.getStudentParticipation(studentId, currentSeason.id);
  
  if (!participation) {
    return res.json({
      success: true,
      data: { 
        participation: null,
        message: 'Not currently participating in leagues'
      }
    });
  }
  
  res.json({
    success: true,
    data: { participation }
  });
}));

/**
 * @route GET /api/leagues/standings/:divisionId
 * @desc Get standings for a specific division
 * @access Public
 */
router.get('/standings/:divisionId', asyncHandler(async (req, res) => {
  const { divisionId } = req.params;
  const { limit = 20, seasonId } = req.query;
  
  const standings = await leagueService.getDivisionStandings(
    parseInt(divisionId), 
    seasonId ? parseInt(seasonId) : null, 
    parseInt(limit)
  );
  
  res.json({
    success: true,
    data: { standings }
  });
}));

/**
 * @route GET /api/leagues/standings
 * @desc Get standings for all divisions
 * @access Public
 */
router.get('/standings', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  
  const allStandings = await leagueService.getAllStandings(parseInt(limit));
  
  res.json({
    success: true,
    data: { standings: allStandings }
  });
}));

/**
 * @route GET /api/leagues/stats
 * @desc Get league statistics
 * @access Public
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const statistics = await leagueService.getLeagueStatistics();
  
  res.json({
    success: true,
    data: { statistics }
  });
}));

/**
 * @route POST /api/leagues/end-season
 * @desc End current season and start new one
 * @access Private (Admin)
 */
router.post('/end-season', requireAdminAuth, asyncHandler(async (req, res) => {
  const result = await leagueService.endCurrentSeasonAndStartNew();
  
  res.json({
    success: true,
    data: { result },
    message: `Season transition completed: ${result.endedSeason.season_name} → ${result.newSeason.season_name}`
  });
}));

/**
 * @route POST /api/leagues/check-new-season
 * @desc Check if it's time for a new season and start it if needed
 * @access Private (Admin)
 */
router.post('/check-new-season', requireAdminAuth, asyncHandler(async (req, res) => {
  const newSeasonStarted = await leagueService.checkAndStartNewSeasonIfNeeded();
  
  res.json({
    success: true,
    data: { newSeasonStarted },
    message: newSeasonStarted ? 'New season started!' : 'Current season is still active'
  });
}));

/**
 * @route GET /api/leagues/my-division-standings
 * @desc Get standings for current student's division
 * @access Private (Student)
 */
router.get('/my-division-standings', requireStudentAuth, asyncHandler(async (req, res) => {
  const studentId = req.session.studentId;
  const { limit = 20 } = req.query;
  
  const currentSeason = await leagueService.getCurrentSeason();
  const participation = await leagueService.getStudentParticipation(studentId, currentSeason.id);
  
  if (!participation) {
    return res.status(404).json({
      success: false,
      message: 'Not currently participating in leagues'
    });
  }
  
  const standings = await leagueService.getDivisionStandings(
    participation.division_id, 
    currentSeason.id, 
    parseInt(limit)
  );
  
  // Find current student's rank
  const studentRank = standings.findIndex(entry => entry.student_id === studentId) + 1;
  
  res.json({
    success: true,
    data: { 
      standings,
      division: participation.league_divisions,
      studentRank: studentRank || null
    }
  });
}));

/**
 * @route GET /api/leagues/weekly-xp-progress
 * @desc Get student's weekly XP progress
 * @access Private (Student)
 */
router.get('/weekly-xp-progress', requireStudentAuth, asyncHandler(async (req, res) => {
  const studentId = req.session.studentId;
  
  const weeklyXP = await leagueService.getStudentWeeklyXP(studentId);
  const divisions = await leagueService.getDivisions();
  const currentDivision = await leagueService.getDivisionForXP(weeklyXP);
  
  // Calculate progress to next division
  const nextDivision = divisions.find(d => d.division_order === currentDivision.division_order + 1);
  let progressToNext = null;
  
  if (nextDivision) {
    const xpNeeded = nextDivision.min_xp_per_week - weeklyXP;
    const progressPercentage = Math.min((weeklyXP / nextDivision.min_xp_per_week) * 100, 100);
    
    progressToNext = {
      nextDivision,
      xpNeeded: Math.max(xpNeeded, 0),
      progressPercentage,
      canPromote: xpNeeded <= 0
    };
  }
  
  res.json({
    success: true,
    data: {
      weeklyXP,
      currentDivision,
      progressToNext,
      allDivisions: divisions
    }
  });
}));

/**
 * @route GET /api/leagues/leaderboard
 * @desc Get overall league leaderboard (top performers across all divisions)
 * @access Public
 */
router.get('/leaderboard', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  
  const currentSeason = await leagueService.getCurrentSeason();
  
  // Get top performers across all divisions
  const { data: topPerformers, error } = await require('../lib/config/database').supabase
    .from('student_league_participation')
    .select(`
      *,
      students (
        id,
        full_name,
        username
      ),
      league_divisions (*)
    `)
    .eq('season_id', currentSeason.id)
    .order('weekly_xp', { ascending: false })
    .limit(parseInt(limit));
  
  if (error) throw error;
  
  // Add global rank
  const leaderboard = topPerformers?.map((entry, index) => ({
    ...entry,
    globalRank: index + 1
  })) || [];
  
  res.json({
    success: true,
    data: { 
      leaderboard,
      season: currentSeason
    }
  });
}));

module.exports = router;