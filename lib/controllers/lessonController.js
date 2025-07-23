const databaseService = require('../services/databaseService');
const sessionService = require('../services/sessionService');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { SUCCESS_MESSAGES } = require('../config/constants');
const aiService = require('../services/ai/aiService');
const imageGenerationService = require('../services/ai/imageGenerationService');
const { assignPointsToQuestions } = require('../utils/pointsDistributor');

class LessonController {
  // Get all lessons with pagination and search
  getAllLessons = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search = '', sort = 'newest', includeStats = 'false', tags } = req.query;
    let sessionData = null;

    try {
      sessionData = sessionService.getSessionData(req);
    } catch (error) {
      console.error('Error getting session data:', error);
      sessionData = { studentId: null, isAuthenticated: false };
    }

    const result = await databaseService.getLessons({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sort,
      tags
    });

    // If includeStats is true and user is admin, add statistics for each lesson
    if (includeStats === 'true' && sessionService.isAdminAuthenticated(req)) {
      try {
        // Get statistics for all lessons using bulk query (fixes N+1 query issue)
        const lessonIds = result.lessons.map(lesson => lesson.id);
        const allResults = await databaseService.getBulkLessonResults(lessonIds);
        
        // Calculate stats for each lesson
        const lessonsWithStats = result.lessons.map(lesson => {
          try {
            const results = allResults[lesson.id] || [];
            
            const studentCount = new Set(results.map(r => r.student_id)).size;
            const totalAttempts = results.length;
            // Completion rate is simply the number of unique students who have attempted the lesson
            // For a more sophisticated metric, we could check if they scored above a threshold
            const completionRate = studentCount;
            
            // Get last activity
            const lastActivity = results.length > 0 ? 
              new Date(Math.max(...results.map(r => new Date(r.timestamp)))).toLocaleString('vi-VN') : null;
            
            return {
              ...lesson,
              studentCount,
              completionRate,
              lastActivity: lastActivity || 'Chưa có hoạt động'
            };
          } catch (error) {
            console.error(`Error getting stats for lesson ${lesson.id}:`, error);
            return lesson;
          }
        });
        
        result.lessons = lessonsWithStats;
      } catch (error) {
        console.error('Error adding statistics to lessons:', error);
        // Continue without stats if there's an error
      }
    }

    // If student is authenticated, add progress information
    if (sessionData && sessionData.studentId) {
      try {
        const completedLessons = await databaseService.getStudentCompletedLessons(sessionData.studentId);
        if (completedLessons && Array.isArray(completedLessons)) {
          const completedIds = completedLessons.map(lesson => lesson.lesson_id);

          // Add completion status to each lesson
          result.lessons = result.lessons.map(lesson => ({
            ...lesson,
            completed: completedIds.includes(lesson.id),
            completedAt: completedLessons.find(cl => cl.lesson_id === lesson.id)?.timestamp || null
          }));
        }
      } catch (error) {
        console.error('Error adding progress info to lessons:', error);
        // Continue without progress info if there's an error
      }
    }

    res.json({
      success: true,
      ...result
    });
  });

  // Get lesson by ID
  getLessonById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    let sessionData = null;

    try {
      sessionData = sessionService.getSessionData(req);
    } catch (error) {
      console.error('Error getting session data:', error);
      sessionData = { studentId: null, isAuthenticated: false };
    }

    const lesson = await databaseService.getLessonById(id);

    // Increment view count
    await databaseService.incrementLessonViews(id, lesson.views || 0);

    let lessonWithProgress = {
      ...lesson,
      views: (lesson.views || 0) + 1
    };

    // If student is authenticated, add progress information
    if (sessionData && sessionData.studentId) {
      try {
        const completedLessons = await databaseService.getStudentCompletedLessons(sessionData.studentId);
        if (completedLessons && Array.isArray(completedLessons)) {
          const completedLesson = completedLessons.find(cl => cl.lesson_id === id);

          lessonWithProgress.completed = !!completedLesson;
          lessonWithProgress.completedAt = completedLesson?.timestamp || null;
          lessonWithProgress.lastScore = completedLesson?.score || null;
          lessonWithProgress.lastTotalPoints = completedLesson?.total_points || null;
        }
      } catch (error) {
        console.error('Error adding progress info to lesson:', error);
        // Continue without progress info if there's an error
        lessonWithProgress.completed = false;
        lessonWithProgress.completedAt = null;
        lessonWithProgress.lastScore = null;
        lessonWithProgress.lastTotalPoints = null;
      }
    }

    res.json({
      success: true,
      lesson: lessonWithProgress
    });
  });

  // Create new lesson (admin only)
  createLesson = asyncHandler(async (req, res) => {
    const lessonData = { ...req.body };

    // Remove CSRF token from lesson data before database insertion
    delete lessonData.csrfToken;
    
    // Assign points to questions based on distribution configuration
    if (lessonData.questions && lessonData.questionTypeDistribution && lessonData.pointsDistribution) {
      lessonData.questions = assignPointsToQuestions(
        lessonData.questions,
        lessonData.questionTypeDistribution,
        lessonData.pointsDistribution
      );
      
      // Log the point assignment for debugging
      console.log('Points assigned to questions:', 
        lessonData.questions.map(q => ({ type: q.type, points: q.points }))
      );
    }
    
    // Generate AI summary if description is blank
    if (!lessonData.description || lessonData.description.trim() === '') {
      try {
        const aiSummary = await aiService.generateLessonSummary({
          title: lessonData.title,
          questions: lessonData.questions || lessonData.quiz?.questions || [],
          grade: lessonData.grade,
          subject: lessonData.subject || 'Vật lý',
          tags: lessonData.tags || []
        });
        
        lessonData.description = aiSummary;
        lessonData.ai_summary = aiSummary;
        lessonData.ai_summary_generated_at = new Date().toISOString();
      } catch (error) {
        console.error('Error generating AI summary:', error);
        // Continue without AI summary if generation fails
      }
    }
    
    const newLesson = await databaseService.createLesson(lessonData);
    
    res.status(201).json({
      success: true,
      message: 'Lesson created successfully',
      lesson: newLesson,
      aiGenerated: !!lessonData.ai_summary
    });
  });

  // Update lesson (admin only)
  updateLesson = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Remove CSRF token from update data before database update
    delete updateData.csrfToken;
    
    // Assign points to questions based on distribution configuration
    if (updateData.questions && updateData.questionTypeDistribution && updateData.pointsDistribution) {
      updateData.questions = assignPointsToQuestions(
        updateData.questions,
        updateData.questionTypeDistribution,
        updateData.pointsDistribution
      );
      
      // Log the point assignment for debugging
      console.log('Points assigned to questions during update:', 
        updateData.questions.map(q => ({ type: q.type, points: q.points }))
      );
    }
    
    // Check if we need to regenerate AI summary
    if (updateData.regenerateAiSummary || 
        (!updateData.description || updateData.description.trim() === '')) {
      try {
        // Get existing lesson data if needed
        const existingLesson = await databaseService.getLessonById(id);
        
        const aiSummary = await aiService.generateLessonSummary({
          title: updateData.title || existingLesson.title,
          questions: updateData.quiz?.questions || existingLesson.quiz?.questions || [],
          grade: updateData.grade || existingLesson.grade,
          subject: updateData.subject || existingLesson.subject || 'Vật lý',
          tags: updateData.tags || existingLesson.tags || []
        });
        
        updateData.description = aiSummary;
        updateData.ai_summary = aiSummary;
        updateData.ai_summary_generated_at = new Date().toISOString();
      } catch (error) {
        console.error('Error regenerating AI summary:', error);
      }
    }
    
    const updatedLesson = await databaseService.updateLesson(id, updateData);
    
    res.json({
      success: true,
      message: SUCCESS_MESSAGES.UPDATE_SUCCESS,
      lesson: updatedLesson[0],
      aiRegenerated: !!updateData.ai_summary
    });
  });

  // Delete lesson (admin only)
  deleteLesson = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    await databaseService.deleteLesson(id);
    
    res.json({
      success: true,
      message: SUCCESS_MESSAGES.DELETE_SUCCESS
    });
  });

  // Update lesson order (admin only)
  updateLessonOrder = asyncHandler(async (req, res) => {
    const { orderedLessons } = req.body;
    
    if (!Array.isArray(orderedLessons)) {
      throw new ValidationError('orderedLessons must be an array');
    }
    
    await databaseService.updateLessonOrder(orderedLessons);
    
    res.json({
      success: true,
      message: 'Lesson order updated successfully'
    });
  });

  // Get lesson statistics
  getLessonStatistics = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Get comprehensive lesson statistics
    const statistics = await databaseService.getLessonDetailedStatistics(id);
    
    res.json(statistics);
  });

  // Get lesson results (admin only)
  getLessonResults = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 100 } = req.query;
    
    const results = await databaseService.getLessonResults(id);
    
    // Limit results if specified
    const limitedResults = limit ? results.slice(0, parseInt(limit)) : results;
    
    res.json({
      success: true,
      results: limitedResults,
      total: results.length
    });
  });

  // Search lessons
  searchLessons = asyncHandler(async (req, res) => {
    const { q: search = '', page = 1, limit = 10, sort = 'newest', tags } = req.query;
    
    const result = await databaseService.getLessons({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sort,
      tags
    });
    
    res.json({
      success: true,
      ...result
    });
  });

  // Get lessons by subject
  getLessonsBySubject = asyncHandler(async (req, res) => {
    const { subject } = req.params;
    const { page = 1, limit = 10, sort = 'newest' } = req.query;
    
    // This would need to be implemented in databaseService
    // For now, use the general getLessons method
    const result = await databaseService.getLessons({
      page: parseInt(page),
      limit: parseInt(limit),
      search: '', // Could filter by subject here
      sort
    });
    
    res.json({
      success: true,
      subject,
      ...result
    });
  });

  // Get lessons by grade
  getLessonsByGrade = asyncHandler(async (req, res) => {
    const { grade } = req.params;
    const { page = 1, limit = 10, sort = 'newest' } = req.query;
    
    // This would need to be implemented in databaseService
    // For now, use the general getLessons method
    const result = await databaseService.getLessons({
      page: parseInt(page),
      limit: parseInt(limit),
      search: '', // Could filter by grade here
      sort
    });
    
    res.json({
      success: true,
      grade,
      ...result
    });
  });

  // Get lessons by tags
  getLessonsByTags = asyncHandler(async (req, res) => {
    const { tags } = req.params;
    const { page = 1, limit = 10, sort = 'newest' } = req.query;
    
    const result = await databaseService.getLessons({
      page: parseInt(page),
      limit: parseInt(limit),
      search: '',
      sort,
      tags
    });
    
    res.json({
      success: true,
      tags,
      ...result
    });
  });

  // Get featured lessons
  getFeaturedLessons = asyncHandler(async (req, res) => {
    const { limit = 5 } = req.query;
    
    // Get most popular lessons (by views)
    const result = await databaseService.getLessons({
      page: 1,
      limit: parseInt(limit),
      search: '',
      sort: 'popular'
    });
    
    res.json({
      success: true,
      featured: result.lessons
    });
  });

  // Get recent lessons
  getRecentLessons = asyncHandler(async (req, res) => {
    const { limit = 5 } = req.query;
    
    // Get newest lessons
    const result = await databaseService.getLessons({
      page: 1,
      limit: parseInt(limit),
      search: '',
      sort: 'newest'
    });
    
    res.json({
      success: true,
      recent: result.lessons
    });
  });

  // Duplicate lesson (admin only)
  duplicateLesson = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const originalLesson = await databaseService.getLessonById(id);
    
    // Create duplicate with modified title
    const duplicateData = {
      ...originalLesson,
      title: `${originalLesson.title} (Copy)`,
      id: undefined, // Let database generate new ID
      created: undefined, // Will be set by createLesson
      last_updated: undefined, // Will be set by createLesson
      views: 0 // Reset views for duplicate
    };
    
    const newLesson = await databaseService.createLesson(duplicateData);
    
    res.status(201).json({
      success: true,
      message: 'Lesson duplicated successfully',
      lesson: newLesson
    });
  });

  // Get student rankings for a lesson (student-accessible)
  getStudentRankings = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Get lesson results with anonymized student data
    const results = await databaseService.getLessonResults(id);
    
    // Transform results to include only necessary data for rankings
    // Remove sensitive information but keep score data
    const transcripts = results.map(result => ({
      student_id: result.student_id || result.studentId,
      score: result.score !== undefined && result.totalPoints !== undefined
        ? `${Math.round((result.score / result.totalPoints) * 100)}%`
        : '0%',
      timestamp: result.timestamp || result.created_at
    }));
    
    res.json({
      success: true,
      transcripts
    });
  });

  // Get last incomplete lesson for authenticated student
  getLastIncompleteLesson = asyncHandler(async (req, res) => {
    const sessionData = sessionService.getSessionData(req);
    if (!sessionData || !sessionData.studentId) {
      throw new ValidationError('Student authentication required');
    }

    // Validate student exists before querying for incomplete lessons
    const studentExists = await databaseService.getStudentById(sessionData.studentId);
    if (!studentExists) {
      throw new ValidationError('Student not found');
    }

    const lastIncompleteLesson = await databaseService.getLastIncompleteLesson(sessionData.studentId);
    
    res.json({
      success: true,
      lesson: lastIncompleteLesson,
      message: lastIncompleteLesson ? 'Last incomplete lesson found' : 'All lessons completed'
    });
  });

  // Get platform statistics for lessons page
  getPlatformStats = asyncHandler(async (req, res) => {
    try {
      const stats = await databaseService.calculatePlatformStats();
      
      // Format for lessons page display
      const formattedStats = {
        totalLessons: stats.totalLessons,
        totalStudents: stats.totalStudents,
        completionRate: stats.totalStudents > 0 ? Math.round((stats.recentActivity / stats.totalStudents) * 100) : 0,
        avgScore: stats.averageScore / 10, // Convert to 0-10 scale for display
        lastUpdated: stats.last_updated || stats.lastUpdated
      };

      res.json({
        success: true,
        data: formattedStats
      });
    } catch (error) {
      console.error('Error getting platform stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error calculating platform statistics'
      });
    }
  });

  // Generate AI image for lesson
  generateLessonImage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { regenerate = false, lessonData } = req.body;
    
    let lesson;
    
    // If ID is provided, get lesson from database
    if (id) {
      lesson = await databaseService.getLessonById(id);
      if (!lesson) {
        throw new NotFoundError('Lesson not found');
      }
    } else if (lessonData) {
      // If lessonData is provided (for new lessons), use it directly
      lesson = lessonData;
    } else {
      throw new ValidationError('Either lesson ID or lesson data must be provided');
    }
    
    // Check if we should generate a new image
    if (lesson.lessonImage && lesson.auto_generated_image && !regenerate) {
      return res.json({
        success: true,
        message: 'Lesson already has an AI-generated image',
        imageUrl: lesson.lessonImage,
        prompt: lesson.ai_image_prompt
      });
    }
    
    try {
      // Get custom prompt from request body if provided
      const customPrompt = req.body.customPrompt;

      // Generate image using AI with optional custom prompt
      const result = await imageGenerationService.generateLessonImage(lesson, customPrompt);

      if (result.success) {
        // Update lesson with generated image info - store base64 image in lessonImage field
        await databaseService.updateLesson(id, {
          lessonImage: result.imageUrl, // This is now a base64 data URL
          ai_image_prompt: result.prompt,
          auto_generated_image: true,
          ai_image_generated_at: new Date().toISOString()
        });

        res.json({
          success: true,
          message: 'Image generated successfully',
          imageUrl: result.imageUrl,
          prompt: result.prompt,
          model: result.model,
          isCustomPrompt: result.isCustomPrompt
        });
      } else {
        throw new Error(result.error || 'Failed to generate image');
      }
    } catch (error) {
      console.error('Error generating lesson image:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate image',
        error: error.message
      });
    }
  });

  // Generate image variations for lesson
  generateImageVariations = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { count = 3 } = req.body;
    
    // Get lesson data
    const lesson = await databaseService.getLessonById(id);
    if (!lesson) {
      throw new NotFoundError('Lesson not found');
    }
    
    try {
      const result = await imageGenerationService.generateImageVariations(lesson, count);
      
      res.json({
        success: result.success,
        message: result.success ? 'Image variations generated successfully' : 'Failed to generate all variations',
        variations: result.variations,
        error: result.error
      });
    } catch (error) {
      console.error('Error generating image variations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate image variations',
        error: error.message
      });
    }
  });

  // Generate AI summary for a lesson
  generateLessonSummary = asyncHandler(async (req, res) => {
    const lessonData = req.body;
    
    try {
      const summary = await aiService.generateLessonSummary(lessonData);
      
      res.json({
        success: true,
        summary: summary
      });
    } catch (error) {
      console.error('Error generating lesson summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate summary',
        error: error.message
      });
    }
  });

  // Bulk generate AI summaries for lessons without descriptions
  bulkGenerateAiSummaries = asyncHandler(async (req, res) => {
    const { limit = 10, dryRun = false } = req.body;
    
    try {
      // Get lessons without descriptions
      const lessonsWithoutDescriptions = await databaseService.getLessonsWithoutDescriptions(limit);
      
      if (dryRun) {
        return res.json({
          success: true,
          message: `Found ${lessonsWithoutDescriptions.length} lessons without descriptions`,
          lessons: lessonsWithoutDescriptions.map(l => ({ id: l.id, title: l.title }))
        });
      }
      
      const results = [];
      
      for (const lesson of lessonsWithoutDescriptions) {
        try {
          const aiSummary = await aiService.generateLessonSummary({
            title: lesson.title,
            questions: lesson.questions || [],
            grade: lesson.grade,
            subject: lesson.subject || 'Vật lý',
            tags: lesson.tags || []
          });
          
          await databaseService.updateLesson(lesson.id, {
            description: aiSummary,
            ai_summary: aiSummary,
            ai_summary_generated_at: new Date().toISOString()
          });
          
          results.push({
            id: lesson.id,
            title: lesson.title,
            success: true,
            summary: aiSummary
          });
        } catch (error) {
          console.error(`Error generating summary for lesson ${lesson.id}:`, error);
          results.push({
            id: lesson.id,
            title: lesson.title,
            success: false,
            error: error.message
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      res.json({
        success: true,
        message: `Generated summaries for ${successCount} out of ${results.length} lessons`,
        results: results
      });
    } catch (error) {
      console.error('Error in bulk summary generation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate summaries',
        error: error.message
      });
    }
  });
}

module.exports = new LessonController();
