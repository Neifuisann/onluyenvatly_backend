/**
 * Utility to distribute points among questions ensuring the total equals the target
 * This solves the floating-point precision issue where 3 × 0.33 = 0.99 instead of 1.00
 */

/**
 * Distributes points among questions of a specific type
 * @param {number} totalPoints - Total points to distribute
 * @param {number} questionCount - Number of questions
 * @returns {number[]} Array of point values for each question
 */
function distributePoints(totalPoints, questionCount) {
    if (questionCount === 0) return [];
    if (totalPoints === 0) return Array(questionCount).fill(0);
    
    // Calculate base points per question (rounded down to 2 decimals)
    const basePoints = Math.floor((totalPoints / questionCount) * 100) / 100;
    
    // Calculate the remainder that needs to be distributed
    const totalAssigned = basePoints * questionCount;
    const remainder = Math.round((totalPoints - totalAssigned) * 100); // Convert to cents to avoid floating point issues
    
    // Create array with base points
    const points = Array(questionCount).fill(basePoints);
    
    // Distribute the remainder by adding 0.01 to some questions
    for (let i = 0; i < remainder; i++) {
        points[i] = Math.round((points[i] + 0.01) * 100) / 100;
    }
    
    return points;
}

/**
 * Assigns points to questions based on type and distribution configuration
 * @param {Array} questions - Array of question objects
 * @param {Object} questionTypeDistribution - How many questions of each type to use
 * @param {Object} pointsDistribution - Total points for each question type
 * @returns {Array} Questions with assigned points
 */
function assignPointsToQuestions(questions, questionTypeDistribution, pointsDistribution) {
    // Group questions by type
    const questionsByType = {
        abcd: [],
        truefalse: [],
        number: []
    };
    
    questions.forEach(q => {
        const normalizedType = normalizeQuestionType(q.type);
        if (questionsByType[normalizedType]) {
            questionsByType[normalizedType].push(q);
        }
    });
    
    // Calculate points for each type
    const pointsByType = {
        abcd: distributePoints(pointsDistribution.abcd || 0, questionTypeDistribution.abcd || 0),
        truefalse: distributePoints(pointsDistribution.truefalse || 0, questionTypeDistribution.truefalse || 0),
        number: distributePoints(pointsDistribution.number || 0, questionTypeDistribution.number || 0)
    };
    
    // Assign points to questions
    const processedQuestions = [];
    
    ['abcd', 'truefalse', 'number'].forEach(type => {
        const typeQuestions = questionsByType[type];
        const typePoints = pointsByType[type];
        const count = questionTypeDistribution[type] || 0;
        
        // Take only the required number of questions
        for (let i = 0; i < Math.min(count, typeQuestions.length); i++) {
            const question = { ...typeQuestions[i] };
            question.points = typePoints[i] || 0;
            processedQuestions.push(question);
        }
    });
    
    return processedQuestions;
}

/**
 * Normalizes question type to standard format
 * @param {string} type - Original question type
 * @returns {string} Normalized type (abcd, truefalse, or number)
 */
function normalizeQuestionType(type) {
    if (!type) return 'abcd';
    
    const lowerType = type.toLowerCase();
    
    if (lowerType === 'multiple_choice' || lowerType === 'abcd') {
        return 'abcd';
    } else if (lowerType === 'true_false' || lowerType === 'truefalse') {
        return 'truefalse';
    } else if (lowerType === 'fill_blank' || lowerType === 'number' || lowerType === 'fillin') {
        return 'number';
    }
    
    return 'abcd'; // Default
}

module.exports = {
    distributePoints,
    assignPointsToQuestions,
    normalizeQuestionType
};