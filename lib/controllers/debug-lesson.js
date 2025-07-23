// Debug controller to help diagnose lesson creation issues
const debugLesson = async (req, res) => {
    try {
        console.log('=== DEBUG LESSON SAVE ===');
        console.log('Request body keys:', Object.keys(req.body));
        console.log('Request headers:', {
            'content-type': req.headers['content-type'],
            'x-csrf-token': req.headers['x-csrf-token'] ? 'present' : 'missing'
        });
        
        if (req.body.questions && Array.isArray(req.body.questions)) {
            console.log('Questions count:', req.body.questions.length);
            req.body.questions.forEach((q, idx) => {
                console.log(`Question ${idx + 1}:`, {
                    question: q.question ? q.question.substring(0, 50) + '...' : 'MISSING',
                    type: q.type,
                    correct: q.correct,
                    correctAnswer: q.correctAnswer,
                    hasOptions: Array.isArray(q.options),
                    optionsCount: q.options?.length || 0,
                    allKeys: Object.keys(q)
                });
            });
            
            // Validate questions format
            const validationErrors = [];
            req.body.questions.forEach((q, idx) => {
                if (!q.question) {
                    validationErrors.push(`Question ${idx + 1}: Missing question text`);
                }
                if (!q.type) {
                    validationErrors.push(`Question ${idx + 1}: Missing type`);
                }
                if (!q.correct && !q.correctAnswer) {
                    validationErrors.push(`Question ${idx + 1}: Missing correct answer`);
                }
            });
            
            if (validationErrors.length > 0) {
                console.log('Validation errors found:', validationErrors);
            }
        }
        
        res.json({ 
            success: true, 
            message: 'Debug data logged to console',
            questionCount: req.body.questions?.length || 0,
            lessonTitle: req.body.title || 'No title'
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Debug endpoint error',
            error: error.message 
        });
    }
};

module.exports = {
    debugLesson
};