const { isValidVietnamesePhone, isValidEmail } = require('./helpers');

/**
 * Validation utility functions
 */

// Validate admin login data
function validateAdminLogin(data) {
  const errors = [];
  
  if (!data.username || typeof data.username !== 'string' || data.username.trim().length === 0) {
    errors.push('Username is required');
  }
  
  if (!data.password || typeof data.password !== 'string' || data.password.length === 0) {
    errors.push('Password is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate student login data
function validateStudentLogin(data) {
  const errors = [];
  
  if (!data.phone_number || !isValidVietnamesePhone(data.phone_number)) {
    errors.push('Valid Vietnamese phone number is required');
  }
  
  if (!data.password || typeof data.password !== 'string' || data.password.length === 0) {
    errors.push('Password is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate student registration data
function validateStudentRegistration(data) {
  const errors = [];
  
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  
  if (!data.phone_number || !isValidVietnamesePhone(data.phone_number)) {
    errors.push('Valid Vietnamese phone number is required');
  }
  
  if (!data.password || typeof data.password !== 'string' || data.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  if (data.email && !isValidEmail(data.email)) {
    errors.push('Valid email address is required');
  }
  
  if (data.grade && (typeof data.grade !== 'number' || data.grade < 6 || data.grade > 12)) {
    errors.push('Grade must be between 6 and 12');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate lesson data
function validateLesson(data) {
  const errors = [];
  
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Lesson title is required');
  }
  
  if (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0) {
    errors.push('Lesson content is required');
  }
  
  if (data.order && (typeof data.order !== 'number' || data.order < 0)) {
    errors.push('Lesson order must be a positive number');
  }
  
  if (data.difficulty && !['easy', 'medium', 'hard'].includes(data.difficulty)) {
    errors.push('Difficulty must be easy, medium, or hard');
  }
  
  if (data.subject && typeof data.subject !== 'string') {
    errors.push('Subject must be a string');
  }
  
  if (data.grade && (typeof data.grade !== 'number' || data.grade < 6 || data.grade > 12)) {
    errors.push('Grade must be between 6 and 12');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate result submission data
function validateResult(data) {
  const errors = [];
  
  if (!data.lessonId || typeof data.lessonId !== 'string') {
    errors.push('Lesson ID is required');
  }
  
  if (!data.answers || !Array.isArray(data.answers)) {
    errors.push('Answers must be an array');
  }
  
  if (data.timeTaken && (typeof data.timeTaken !== 'number' || data.timeTaken < 0)) {
    errors.push('Time taken must be a positive number');
  }
  
  if (!data.studentInfo || typeof data.studentInfo !== 'object') {
    errors.push('Student info is required');
  } else {
    if (!data.studentInfo.name || typeof data.studentInfo.name !== 'string') {
      errors.push('Student name is required in student info');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate pagination parameters
function validatePagination(query) {
  const errors = [];
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  
  if (page < 1) {
    errors.push('Page must be greater than 0');
  }
  
  if (limit < 1 || limit > 100) {
    errors.push('Limit must be between 1 and 100');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    page,
    limit
  };
}

// Validate search parameters
function validateSearch(query) {
  const errors = [];
  const search = query.search || query.q || '';
  
  if (search && typeof search !== 'string') {
    errors.push('Search query must be a string');
  }
  
  if (search && search.length > 100) {
    errors.push('Search query must be less than 100 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    search: search.trim()
  };
}

// Validate ID parameter
function validateId(id) {
  const errors = [];
  
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    errors.push('ID is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate file upload
function validateFileUpload(file) {
  const errors = [];
  
  if (!file) {
    errors.push('File is required');
    return { isValid: false, errors };
  }
  
  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push('File size must be less than 10MB');
  }
  
  // Check file type
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (!allowedTypes.includes(file.mimetype)) {
    errors.push('File type not allowed');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate rating data
function validateRatingData(score, totalPoints, timeTaken, streak) {
  const errors = [];
  
  if (typeof score !== 'number' || score < 0) {
    errors.push('Score must be a non-negative number');
  }
  
  if (typeof totalPoints !== 'number' || totalPoints <= 0) {
    errors.push('Total points must be a positive number');
  }
  
  if (score > totalPoints) {
    errors.push('Score cannot be greater than total points');
  }
  
  if (typeof timeTaken !== 'number' || timeTaken < 0) {
    errors.push('Time taken must be a non-negative number');
  }
  
  if (typeof streak !== 'number' || streak < 0) {
    errors.push('Streak must be a non-negative number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate password strength
function validatePasswordStrength(password) {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { isValid: false, errors };
  }
  
  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  // Check for at least one letter and one number (optional but recommended)
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  
  if (!hasLetter || !hasNumber) {
    // This is a warning, not an error
    return {
      isValid: true,
      errors,
      warnings: ['Password should contain both letters and numbers for better security']
    };
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate Vietnamese name
function validateVietnameseName(name) {
  const errors = [];
  
  if (!name || typeof name !== 'string') {
    errors.push('Name is required');
    return { isValid: false, errors };
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  
  if (trimmedName.length > 50) {
    errors.push('Name must be less than 50 characters');
  }
  
  // Check for Vietnamese name pattern (letters, spaces, and Vietnamese characters)
  const vietnameseNamePattern = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵýỷỹ\s]+$/;
  
  if (!vietnameseNamePattern.test(trimmedName)) {
    errors.push('Name contains invalid characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateAdminLogin,
  validateStudentLogin,
  validateStudentRegistration,
  validateLesson,
  validateResult,
  validatePagination,
  validateSearch,
  validateId,
  validateFileUpload,
  validateRatingData,
  validatePasswordStrength,
  validateVietnameseName
};
