const { supabase } = require('../config/database');
const xpService = require('./xpService');

class LeagueService {
  /**
   * Get or create current active league season
   * @returns {Promise<Object>} Active league season
   */
  async getCurrentSeason() {
    try {
      // Check for active season
      const { data: activeSeason, error } = await supabase
        .from('league_seasons')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (activeSeason) {
        return activeSeason;
      }

      // Create new season if none exists
      return await this.createNewSeason();
    } catch (error) {
      console.error('Error getting current season:', error);
      throw error;
    }
  }

  /**
   * Create a new league season
   * @returns {Promise<Object>} Created season
   */
  async createNewSeason() {
    try {
      const now = new Date();
      const seasonStart = new Date(now);
      seasonStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
      
      const seasonEnd = new Date(seasonStart);
      seasonEnd.setDate(seasonStart.getDate() + 6); // End of week (Saturday)
      
      // Generate season name
      const seasonName = `Week of ${seasonStart.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })}`;

      const { data: newSeason, error } = await supabase
        .from('league_seasons')
        .insert({
          season_name: seasonName,
          start_date: seasonStart.toISOString().split('T')[0],
          end_date: seasonEnd.toISOString().split('T')[0],
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`Created new league season: ${seasonName}`);
      return newSeason;
    } catch (error) {
      console.error('Error creating new season:', error);
      throw error;
    }
  }

  /**
   * Get all available league divisions
   * @returns {Promise<Array>} League divisions
   */
  async getDivisions() {
    try {
      const { data: divisions, error } = await supabase
        .from('league_divisions')
        .select('*')
        .order('division_order');

      if (error) throw error;
      return divisions || [];
    } catch (error) {
      console.error('Error getting divisions:', error);
      return [];
    }
  }

  /**
   * Determine appropriate division for a student based on their XP
   * @param {number} weeklyXP - Student's weekly XP
   * @returns {Promise<Object>} Appropriate division
   */
  async getDivisionForXP(weeklyXP) {
    try {
      const divisions = await this.getDivisions();
      
      // Find the highest division the student qualifies for
      let appropriateDivision = divisions[0]; // Default to lowest division
      
      for (const division of divisions) {
        if (weeklyXP >= division.min_xp_per_week && 
            (division.max_xp_per_week === null || weeklyXP <= division.max_xp_per_week)) {
          appropriateDivision = division;
        }
      }
      
      return appropriateDivision;
    } catch (error) {
      console.error('Error determining division for XP:', error);
      return await this.getLowestDivision();
    }
  }

  /**
   * Get the lowest division (entry level)
   * @returns {Promise<Object>} Lowest division
   */
  async getLowestDivision() {
    try {
      const { data: division, error } = await supabase
        .from('league_divisions')
        .select('*')
        .order('division_order')
        .limit(1)
        .single();

      if (error) throw error;
      return division;
    } catch (error) {
      console.error('Error getting lowest division:', error);
      return {
        id: 1,
        name: 'Electron League',
        min_xp_per_week: 0,
        max_xp_per_week: 499,
        division_order: 1,
        icon: '⚛️',
        color: '#6366F1'
      };
    }
  }

  /**
   * Join a student to the current league season
   * @param {number} studentId - Student ID
   * @returns {Promise<Object>} League participation record
   */
  async joinCurrentSeason(studentId) {
    try {
      const currentSeason = await this.getCurrentSeason();
      
      // Check if student is already in this season
      const existingParticipation = await this.getStudentParticipation(studentId, currentSeason.id);
      if (existingParticipation) {
        return existingParticipation;
      }

      // Get student's recent XP to determine division
      const weeklyXP = await this.getStudentWeeklyXP(studentId);
      const division = await this.getDivisionForXP(weeklyXP);

      // Create participation record
      const { data: participation, error } = await supabase
        .from('student_league_participation')
        .insert({
          student_id: studentId,
          season_id: currentSeason.id,
          division_id: division.id,
          weekly_xp: weeklyXP,
          rank_in_division: null, // Will be calculated later
          promoted: false,
          demoted: false,
          joined_at: new Date().toISOString()
        })
        .select(`
          *,
          league_seasons (*),
          league_divisions (*)
        `)
        .single();

      if (error) throw error;

      console.log(`Student ${studentId} joined ${division.name} for season ${currentSeason.season_name}`);
      return participation;
    } catch (error) {
      console.error('Error joining current season:', error);
      throw error;
    }
  }

  /**
   * Get student's participation in a specific season
   * @param {number} studentId - Student ID
   * @param {number} seasonId - Season ID
   * @returns {Promise<Object|null>} Participation record
   */
  async getStudentParticipation(studentId, seasonId) {
    try {
      const { data: participation, error } = await supabase
        .from('student_league_participation')
        .select(`
          *,
          league_seasons (*),
          league_divisions (*)
        `)
        .eq('student_id', studentId)
        .eq('season_id', seasonId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return participation;
    } catch (error) {
      console.error('Error getting student participation:', error);
      return null;
    }
  }

  /**
   * Update student's weekly XP in current season
   * @param {number} studentId - Student ID
   * @param {number} xpAmount - XP amount to add
   * @returns {Promise<Object>} Updated participation record
   */
  async updateStudentWeeklyXP(studentId, xpAmount) {
    try {
      const currentSeason = await this.getCurrentSeason();
      let participation = await this.getStudentParticipation(studentId, currentSeason.id);

      // Join season if not already in it
      if (!participation) {
        participation = await this.joinCurrentSeason(studentId);
      }

      const newWeeklyXP = participation.weekly_xp + xpAmount;
      
      // Check if student should be promoted/demoted
      const currentDivision = participation.league_divisions;
      const newDivision = await this.getDivisionForXP(newWeeklyXP);
      const divisionChanged = newDivision.id !== currentDivision.id;

      // Update participation record
      const { data: updatedParticipation, error } = await supabase
        .from('student_league_participation')
        .update({
          weekly_xp: newWeeklyXP,
          division_id: newDivision.id,
          promoted: divisionChanged && newDivision.division_order > currentDivision.division_order,
          demoted: divisionChanged && newDivision.division_order < currentDivision.division_order
        })
        .eq('id', participation.id)
        .select(`
          *,
          league_seasons (*),
          league_divisions (*)
        `)
        .single();

      if (error) throw error;

      // Log division change if applicable
      if (divisionChanged) {
        const changeType = newDivision.division_order > currentDivision.division_order ? 'promoted' : 'demoted';
        console.log(`Student ${studentId} ${changeType} from ${currentDivision.name} to ${newDivision.name}`);
        
        // Create activity log for promotion/demotion
        await this.logDivisionChange(studentId, currentDivision, newDivision, changeType);
      }

      return updatedParticipation;
    } catch (error) {
      console.error('Error updating student weekly XP:', error);
      throw error;
    }
  }

  /**
   * Get student's weekly XP from recent transactions
   * @param {number} studentId - Student ID
   * @returns {Promise<number>} Weekly XP total
   */
  async getStudentWeeklyXP(studentId) {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: transactions, error } = await supabase
        .from('xp_transactions')
        .select('xp_amount')
        .eq('student_id', studentId)
        .gte('created_at', oneWeekAgo.toISOString())
        .gt('xp_amount', 0); // Only positive XP

      if (error) throw error;

      const weeklyXP = transactions?.reduce((total, transaction) => total + transaction.xp_amount, 0) || 0;
      return weeklyXP;
    } catch (error) {
      console.error('Error getting student weekly XP:', error);
      return 0;
    }
  }

  /**
   * Get league standings for a division
   * @param {number} divisionId - Division ID
   * @param {number} seasonId - Season ID (optional, defaults to current)
   * @param {number} limit - Number of students to return
   * @returns {Promise<Array>} Division standings
   */
  async getDivisionStandings(divisionId, seasonId = null, limit = 20) {
    try {
      if (!seasonId) {
        const currentSeason = await this.getCurrentSeason();
        seasonId = currentSeason.id;
      }

      const { data: standings, error } = await supabase
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
        .eq('division_id', divisionId)
        .eq('season_id', seasonId)
        .order('weekly_xp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Add rank numbers
      const rankedStandings = standings?.map((entry, index) => ({
        ...entry,
        rank: index + 1
      })) || [];

      return rankedStandings;
    } catch (error) {
      console.error('Error getting division standings:', error);
      return [];
    }
  }

  /**
   * Get all league standings for current season
   * @param {number} limit - Number of students per division
   * @returns {Promise<Object>} All division standings
   */
  async getAllStandings(limit = 10) {
    try {
      const divisions = await this.getDivisions();
      const standings = {};

      for (const division of divisions) {
        standings[division.name] = await this.getDivisionStandings(division.id, null, limit);
      }

      return standings;
    } catch (error) {
      console.error('Error getting all standings:', error);
      return {};
    }
  }

  /**
   * Get league statistics
   * @returns {Promise<Object>} League statistics
   */
  async getLeagueStatistics() {
    try {
      const currentSeason = await this.getCurrentSeason();
      const divisions = await this.getDivisions();

      // Get total participants
      const { count: totalParticipants } = await supabase
        .from('student_league_participation')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', currentSeason.id);

      // Get participants by division
      const divisionCounts = {};
      for (const division of divisions) {
        const { count } = await supabase
          .from('student_league_participation')
          .select('*', { count: 'exact', head: true })
          .eq('season_id', currentSeason.id)
          .eq('division_id', division.id);
        
        divisionCounts[division.name] = count || 0;
      }

      // Get recent promotions/demotions
      const { data: recentChanges } = await supabase
        .from('student_league_participation')
        .select(`
          promoted,
          demoted,
          students (full_name),
          league_divisions (name, icon)
        `)
        .eq('season_id', currentSeason.id)
        .or('promoted.eq.true,demoted.eq.true')
        .order('joined_at', { ascending: false })
        .limit(10);

      return {
        currentSeason,
        totalParticipants: totalParticipants || 0,
        divisionCounts,
        recentChanges: recentChanges || [],
        divisions
      };
    } catch (error) {
      console.error('Error getting league statistics:', error);
      return {
        currentSeason: null,
        totalParticipants: 0,
        divisionCounts: {},
        recentChanges: [],
        divisions: []
      };
    }
  }

  /**
   * End current season and start new one
   * @returns {Promise<Object>} Results of season transition
   */
  async endCurrentSeasonAndStartNew() {
    try {
      const currentSeason = await this.getCurrentSeason();
      
      // Mark current season as inactive
      await supabase
        .from('league_seasons')
        .update({ is_active: false })
        .eq('id', currentSeason.id);

      // Calculate final rankings
      const finalRankings = await this.calculateFinalRankings(currentSeason.id);
      
      // Reset weekly XP for all participants
      await supabase
        .from('student_league_participation')
        .update({ 
          weekly_xp: 0,
          promoted: false,
          demoted: false 
        })
        .eq('season_id', currentSeason.id);

      // Create new season
      const newSeason = await this.createNewSeason();

      console.log(`Season transition completed: ${currentSeason.season_name} -> ${newSeason.season_name}`);
      
      return {
        endedSeason: currentSeason,
        newSeason,
        finalRankings
      };
    } catch (error) {
      console.error('Error ending season and starting new:', error);
      throw error;
    }
  }

  /**
   * Calculate final rankings for a season
   * @param {number} seasonId - Season ID
   * @returns {Promise<Object>} Final rankings by division
   */
  async calculateFinalRankings(seasonId) {
    try {
      const divisions = await this.getDivisions();
      const rankings = {};

      for (const division of divisions) {
        const standings = await this.getDivisionStandings(division.id, seasonId, 100);
        
        // Update rank_in_division for all participants
        for (const standing of standings) {
          await supabase
            .from('student_league_participation')
            .update({ rank_in_division: standing.rank })
            .eq('id', standing.id);
        }
        
        rankings[division.name] = standings;
      }

      return rankings;
    } catch (error) {
      console.error('Error calculating final rankings:', error);
      return {};
    }
  }

  /**
   * Log division change activity
   * @param {number} studentId - Student ID
   * @param {Object} oldDivision - Previous division
   * @param {Object} newDivision - New division
   * @param {string} changeType - 'promoted' or 'demoted'
   */
  async logDivisionChange(studentId, oldDivision, newDivision, changeType) {
    try {
      // Use lazy loading to avoid circular dependency
      const activityService = require('./activityService');
      
      let title, description;
      if (changeType === 'promoted') {
        title = `🎉 Promoted to ${newDivision.name}!`;
        description = `Advanced from ${oldDivision.name} to ${newDivision.name}`;
      } else {
        title = `📉 Moved to ${newDivision.name}`;
        description = `Transferred from ${oldDivision.name} to ${newDivision.name}`;
      }

      await activityService.createActivity(
        studentId,
        'league_division_change',
        title,
        description,
        {
          oldDivision: {
            id: oldDivision.id,
            name: oldDivision.name,
            icon: oldDivision.icon
          },
          newDivision: {
            id: newDivision.id,
            name: newDivision.name,
            icon: newDivision.icon
          },
          changeType
        },
        true
      );
    } catch (error) {
      console.error('Error logging division change activity:', error);
    }
  }

  /**
   * Check if it's time for a new season (called by scheduler)
   * @returns {Promise<boolean>} Whether a new season was started
   */
  async checkAndStartNewSeasonIfNeeded() {
    try {
      const currentSeason = await this.getCurrentSeason();
      const today = new Date().toISOString().split('T')[0];
      
      // Check if current season has ended
      if (currentSeason.end_date < today) {
        await this.endCurrentSeasonAndStartNew();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking for new season:', error);
      return false;
    }
  }
}

module.exports = new LeagueService();