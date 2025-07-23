const fs = require('fs').promises;
const path = require('path');
const { asyncHandler } = require('../middleware/errorHandler');

class GalleryController {
    getGalleryImages = asyncHandler(async (req, res) => {
        const imagesDir = path.join(process.cwd(), 'public', 'lesson_handout');
        
        try {
            // Ensure directory exists
            try {
                await fs.access(imagesDir);
            } catch (dirError) {
                if (dirError.code === 'ENOENT') {
                    await fs.mkdir(imagesDir, { recursive: true });
                } else {
                    throw dirError;
                }
            }
            
            // Read directory
            const dirents = await fs.readdir(imagesDir, { withFileTypes: true });
            const files = dirents
                .filter(dirent => dirent.isFile() && /\.(jpg|jpeg|png|gif)$/i.test(dirent.name))
                .map(dirent => `/lesson_handout/${dirent.name}`)
                .sort();
            
            res.json(files);
        } catch (error) {
            console.error('Error reading gallery images:', error);
            res.status(500).json({ error: 'Failed to load gallery images' });
        }
    });
}

module.exports = new GalleryController();
