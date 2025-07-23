const databaseService = require('../services/databaseService');
const { asyncHandler } = require('../middleware/errorHandler');

class HistoryController {
    // Get history with pagination and search
    getHistory = asyncHandler(async (req, res) => {
        const { page = 1, limit = 15, search = '', sort = 'time-desc' } = req.query;
        
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            search: search.trim(),
            sort
        };
        
        const result = await databaseService.getHistoryWithPagination(options);
        res.json(result);
    });
    
    // Delete a specific result
    deleteResult = asyncHandler(async (req, res) => {
        const { resultId } = req.params;
        
        await databaseService.deleteResult(resultId);
        
        res.json({ 
            success: true, 
            message: 'Result deleted successfully' 
        });
    });
    
    // Get lesson results
    getLessonResults = asyncHandler(async (req, res) => {
        const { lessonId } = req.params;
        
        const results = await databaseService.getLessonResultsWithStudents(lessonId);
        res.json(results);
    });
}

module.exports = new HistoryController();
