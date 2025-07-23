const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

// Get materials for a specific grade
router.get('/grade/:gradeId', async (req, res) => {
    const gradeId = req.params.gradeId;
    
    try {
        // Validate grade ID
        if (!['10', '11', '12'].includes(gradeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid grade ID. Must be 10, 11, or 12.'
            });
        }

        // Path to grade materials
        const materialsPath = path.join(__dirname, '..', 'materials', `grade${gradeId}`, 'index.json');
        
        // Check if materials exist
        try {
            await fs.access(materialsPath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                message: `Materials for grade ${gradeId} not found`
            });
        }

        // Read materials data
        const materialsData = await fs.readFile(materialsPath, 'utf-8');
        const materials = JSON.parse(materialsData);

        res.json({
            success: true,
            materials: materials
        });

    } catch (error) {
        console.error('Error loading materials:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading materials',
            error: error.message
        });
    }
});


// Get list of all available materials (for search/discovery)
router.get('/all', async (req, res) => {
    try {
        const allMaterials = [];
        
        for (const grade of ['10', '11', '12']) {
            const indexPath = path.join(__dirname, '..', 'materials', `grade${grade}`, 'index.json');
            
            try {
                const data = await fs.readFile(indexPath, 'utf-8');
                const materials = JSON.parse(data);
                
                allMaterials.push({
                    grade: parseInt(grade),
                    ...materials
                });
            } catch (error) {
                console.log(`No materials found for grade ${grade}`);
            }
        }

        res.json({
            success: true,
            materials: allMaterials
        });

    } catch (error) {
        console.error('Error loading all materials:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading materials'
        });
    }
});

module.exports = router;