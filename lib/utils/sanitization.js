// HTML sanitization utility functions

/**
 * Escape HTML characters to prevent XSS attacks
 * @param {string} str - The string to sanitize
 * @returns {string} - The sanitized string
 */
function escapeHtml(str) {
  if (!str) return '';
  
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  
  return String(str).replace(/[&<>"'\/]/g, (match) => htmlEntities[match]);
}

/**
 * Sanitize user input by escaping HTML and trimming whitespace
 * @param {string} input - The input to sanitize
 * @returns {string} - The sanitized input
 */
function sanitizeInput(input) {
  if (!input) return '';
  
  // Trim whitespace
  let sanitized = String(input).trim();
  
  // Escape HTML characters
  sanitized = escapeHtml(sanitized);
  
  return sanitized;
}

/**
 * Sanitize an object's string properties
 * @param {Object} obj - The object to sanitize
 * @param {Array<string>} fields - The fields to sanitize (optional, defaults to all string fields)
 * @returns {Object} - The sanitized object
 */
function sanitizeObject(obj, fields = null) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = { ...obj };
  const fieldsToSanitize = fields || Object.keys(obj);
  
  fieldsToSanitize.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeInput(sanitized[field]);
    }
  });
  
  return sanitized;
}

module.exports = {
  escapeHtml,
  sanitizeInput,
  sanitizeObject
};