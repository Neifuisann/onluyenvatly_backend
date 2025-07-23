const databaseService = require('../services/databaseService');
const { asyncHandler } = require('../middleware/errorHandler');

class TagsController {
    getAllTags = asyncHandler(async (req, res) => {
        const tags = await databaseService.getAllUniqueTags();
        res.json(tags);
    });

    getPopularTags = asyncHandler(async (req, res) => {
        const { limit = 10 } = req.query;
        console.log(`[TagsController] Getting popular tags with limit: ${limit}`);

        const popularTags = await databaseService.getPopularTags(parseInt(limit));

        console.log(`[TagsController] Returning ${popularTags.length} popular tags`);

        res.json({
            success: true,
            tags: popularTags,
            count: popularTags.length
        });
    });

    getRelatedTags = asyncHandler(async (req, res) => {
        const { tag } = req.params;
        console.log(`[TagsController] Getting related tags for: ${tag}`);

        const relatedTags = await databaseService.getRelatedTags(tag);

        console.log(`[TagsController] Returning ${relatedTags.length} related tags`);

        res.json({
            success: true,
            selectedTag: tag,
            relatedTags: relatedTags,
            count: relatedTags.length
        });
    });

    getIntersectionTags = asyncHandler(async (req, res) => {
        const { tags } = req.query; // Expecting comma-separated tags
        const selectedTags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

        console.log(`[TagsController] Getting intersection tags for: ${selectedTags.join(', ')}`);

        const intersectionTags = await databaseService.getIntersectionTags(selectedTags);

        console.log(`[TagsController] Returning ${intersectionTags.length} intersection tags`);

        res.json({
            success: true,
            selectedTags: selectedTags,
            intersectionTags: intersectionTags,
            count: intersectionTags.length
        });
    });

    getCompleteTags = asyncHandler(async (req, res) => {
        const { limit = 10 } = req.query;
        console.log(`[TagsController] Getting complete tags data with limit: ${limit}`);

        // Get popular tags with statistics
        const popularTags = await databaseService.getPopularTags(parseInt(limit));

        // Get tag-to-lessons mapping for client-side filtering
        const tagToLessons = await databaseService.getTagToLessonsMapping();

        console.log(`[TagsController] Returning complete tags data: ${popularTags.length} tags`);

        res.json({
            success: true,
            tags: popularTags,
            tagToLessons: tagToLessons,
            count: popularTags.length
        });
    });
}

module.exports = new TagsController();
