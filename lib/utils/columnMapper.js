/**
 * Column mapping utility to handle the transition from old column names to new standardized snake_case names
 * This helps maintain backward compatibility while we update the codebase
 */

const columnMappings = {
  lessons: {
    // Original camelCase to new snake_case
    lastUpdated: 'last_updated',
    lessonImage: 'lesson_image',
    // New columns that were added in lowercase, now snake_case
    timeLimitEnabled: 'time_limit_enabled',
    timeLimitHours: 'time_limit_hours',
    timeLimitMinutes: 'time_limit_minutes',
    timeLimitSeconds: 'time_limit_seconds',
    showCountdown: 'show_countdown',
    autoSubmit: 'auto_submit',
    warningAlerts: 'warning_alerts',
    shuffleQuestions: 'shuffle_questions',
    shuffleAnswers: 'shuffle_answers',
    enableQuestionPool: 'enable_question_pool',
    questionPoolSize: 'question_pool_size',
    difficultyRatios: 'difficulty_ratios',
    questionTypeDistribution: 'question_type_distribution',
    pointsDistribution: 'points_distribution',
    randomizationSeed: 'randomization_seed'
  },
  results: {
    lessonId: 'lesson_id',
    totalPoints: 'total_points',
    studentInfo: 'student_info',
    ipAddress: 'ip_address',
    timeTaken: 'time_taken'
  },
  quiz_results: {
    quizid: 'quiz_id',
    studentname: 'student_name',
    totalquestions: 'total_questions',
    userid: 'user_id'
  }
};

/**
 * Maps JavaScript object keys from code conventions to database column names
 * @param {string} tableName - The table name
 * @param {object} data - The data object with code-style keys
 * @returns {object} Object with database column names
 */
function mapColumnsToDb(tableName, data) {
  if (!data || typeof data !== 'object') return data;
  
  const mappings = columnMappings[tableName] || {};
  const mapped = {};
  
  for (const [key, value] of Object.entries(data)) {
    const dbColumn = mappings[key] || key;
    mapped[dbColumn] = value;
  }
  
  return mapped;
}

/**
 * Maps database column names back to JavaScript code conventions
 * @param {string} tableName - The table name
 * @param {object} data - The data object with database column names
 * @returns {object} Object with code-style keys
 */
function mapColumnsFromDb(tableName, data) {
  if (!data || typeof data !== 'object') return data;
  
  const mappings = columnMappings[tableName] || {};
  const reverseMappings = Object.entries(mappings)
    .reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {});
  
  const mapped = {};
  
  for (const [key, value] of Object.entries(data)) {
    const codeColumn = reverseMappings[key] || key;
    mapped[codeColumn] = value;
  }
  
  return mapped;
}

/**
 * Maps an array of objects
 * @param {string} tableName - The table name
 * @param {array} dataArray - Array of data objects
 * @param {boolean} toDb - If true, maps to DB columns; if false, maps from DB columns
 * @returns {array} Array of mapped objects
 */
function mapArrayColumns(tableName, dataArray, toDb = true) {
  if (!Array.isArray(dataArray)) return dataArray;
  
  const mapFn = toDb ? mapColumnsToDb : mapColumnsFromDb;
  return dataArray.map(item => mapFn(tableName, item));
}

/**
 * Gets the database column name for a given code column name
 * @param {string} tableName - The table name
 * @param {string} codeColumn - The code-style column name
 * @returns {string} The database column name
 */
function getDbColumn(tableName, codeColumn) {
  const mappings = columnMappings[tableName] || {};
  return mappings[codeColumn] || codeColumn;
}

/**
 * Gets the code column name for a given database column name
 * @param {string} tableName - The table name
 * @param {string} dbColumn - The database column name
 * @returns {string} The code-style column name
 */
function getCodeColumn(tableName, dbColumn) {
  const mappings = columnMappings[tableName] || {};
  const reverseMappings = Object.entries(mappings)
    .reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {});
  
  return reverseMappings[dbColumn] || dbColumn;
}

module.exports = {
  mapColumnsToDb,
  mapColumnsFromDb,
  mapArrayColumns,
  getDbColumn,
  getCodeColumn,
  columnMappings
};