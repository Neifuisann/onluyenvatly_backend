const { ERROR_MESSAGES } = require('../config/constants');

// Validation helper functions
const isValidPhoneNumber = (phone) => {
  // Vietnamese phone number validation
  const phoneRegex = /^(0|\+84)[3-9]\d{8}$/;
  return phoneRegex.test(phone);
};

const isValidPassword = (password) => {
  // At least 8 characters with complexity requirements
  if (!password || password.length < 8) {
    return false;
  }
  
  // Must contain at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return false;
  }
  
  // Must contain at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return false;
  }
  
  // Must contain at least one number
  if (!/\d/.test(password)) {
    return false;
  }
  
  // Must contain at least one special character
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return false;
  }
  
  return true;
};

const isValidName = (name) => {
  // At least 2 characters, only letters and spaces
  const nameRegex = /^[a-zA-ZÀ-ỹ\s]{2,50}$/;
  return nameRegex.test(name);
};

const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidId = (id) => {
  return id && (typeof id === 'string' || typeof id === 'number') && id.toString().length > 0;
};

// Validation middleware for student registration
const validateStudentRegistration = (req, res, next) => {
  const { full_name, phone_number, password, date_of_birth } = req.body;
  const errors = [];

  if (!full_name || !isValidName(full_name)) {
    errors.push('Họ tên không hợp lệ (2-50 ký tự, chỉ chữ cái và khoảng trắng)');
  }

  if (!phone_number || !isValidPhoneNumber(phone_number)) {
    errors.push('Số điện thoại không hợp lệ');
  }

  if (!password || !isValidPassword(password)) {
    errors.push('Mật khẩu phải có ít nhất 8 ký tự, bao gồm: chữ hoa, chữ thường, số và ký tự đặc biệt');
  }

  if (date_of_birth && !isValidDate(date_of_birth)) {
    errors.push('Ngày sinh không hợp lệ');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: ERROR_MESSAGES.VALIDATION_ERROR,
      message: 'Dữ liệu đầu vào không hợp lệ',
      details: errors
    });
  }

  next();
};

// Validation middleware for student login
const validateStudentLogin = (req, res, next) => {
  const { phone_number, password } = req.body;
  const errors = [];

  if (!phone_number || !isValidPhoneNumber(phone_number)) {
    errors.push('Số điện thoại không hợp lệ');
  }

  if (!password) {
    errors.push('Mật khẩu không được để trống');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: ERROR_MESSAGES.VALIDATION_ERROR,
      message: 'Dữ liệu đăng nhập không hợp lệ',
      details: errors
    });
  }

  next();
};

// Validation middleware for admin login
const validateAdminLogin = (req, res, next) => {
  const { username, password } = req.body;
  const errors = [];

  if (!username || username.trim().length === 0) {
    errors.push('Tên đăng nhập không được để trống');
  }

  if (!password || password.length === 0) {
    errors.push('Mật khẩu không được để trống');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: ERROR_MESSAGES.VALIDATION_ERROR,
      message: 'Dữ liệu đăng nhập không hợp lệ',
      details: errors
    });
  }

  next();
};

// Validation middleware for lesson creation/update
const validateLesson = (req, res, next) => {
  console.log('validateLesson - Request body keys:', Object.keys(req.body));
  console.log('validateLesson - Questions structure:');
  const questionsToLog = req.body.questions || (req.body.quiz && req.body.quiz.questions) || [];
  if (questionsToLog && Array.isArray(questionsToLog)) {
    console.log(`  Questions found at: ${req.body.questions ? 'root.questions' : req.body.quiz ? 'root.quiz.questions' : 'not found'}`);
    questionsToLog.forEach((q, idx) => {
      console.log(`  Question ${idx + 1}:`, {
        type: q.type,
        hasCorrect: 'correct' in q,
        hasCorrectAnswer: 'correctAnswer' in q,
        correctValue: q.correct,
        correctAnswerValue: q.correctAnswer,
        options: Array.isArray(q.options) ? q.options.length : 'not array'
      });
    });
  }
  const { title, content, questions, quiz, subject, grade, color, description, tags } = req.body;
  const errors = [];
  
  // Extract questions from either root level or quiz object
  const actualQuestions = questions || (quiz && quiz.questions) || [];
  
  // Check if this is a partial update (only color field for example)
  const isPartialUpdate = req.method === 'PUT' && Object.keys(req.body).length === 1;
  
  // For partial updates, skip required field validation
  if (!isPartialUpdate) {
    if (!title || title.trim().length === 0) {
      errors.push('Tiêu đề bài học không được để trống');
    }

    // Modern lessons use questions array instead of content
    // Accept either content (legacy) or questions (modern) or quiz.questions (new format)
    if ((!content || content.trim().length === 0) && (!actualQuestions || !Array.isArray(actualQuestions) || actualQuestions.length === 0)) {
      errors.push('Bài học phải có nội dung hoặc ít nhất một câu hỏi');
    }

    // Validate questions structure if provided
    if (actualQuestions && Array.isArray(actualQuestions)) {
      actualQuestions.forEach((q, index) => {
        if (!q.question || typeof q.question !== 'string') {
          errors.push(`Câu hỏi ${index + 1}: Nội dung câu hỏi không hợp lệ`);
        }
        // Accept both old and new question type formats
        const validTypes = ['multiple_choice', 'true_false', 'fill_blank', 'abcd', 'truefalse', 'number'];
        if (!q.type || !validTypes.includes(q.type)) {
          errors.push(`Câu hỏi ${index + 1}: Loại câu hỏi không hợp lệ`);
        }
        // For multiple choice questions (both formats)
        if ((q.type === 'multiple_choice' || q.type === 'abcd') &&
            (!q.options || !Array.isArray(q.options) || q.options.length < 2)) {
          errors.push(`Câu hỏi ${index + 1}: Câu hỏi trắc nghiệm phải có ít nhất 2 lựa chọn`);
        }
        // Accept both 'correctAnswer' and 'correct' properties
        if (!q.correctAnswer && !q.correct) {
          errors.push(`Câu hỏi ${index + 1}: Thiếu đáp án đúng`);
        }
      });
    }
  }

  // Validate optional fields if present
  if (subject && typeof subject !== 'string') {
    errors.push('Môn học phải là chuỗi ký tự');
  }

  if (grade && (typeof grade !== 'string' && typeof grade !== 'number')) {
    errors.push('Lớp học không hợp lệ');
  }
  
  // Validate color field if present
  if (color && (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color))) {
    errors.push('Màu sắc phải là mã hex hợp lệ (ví dụ: #FF0000)');
  }

  // Validate description if present
  if (description && typeof description !== 'string') {
    errors.push('Mô tả phải là chuỗi ký tự');
  }

  // Validate tags if present
  if (tags && (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string'))) {
    errors.push('Tags phải là mảng các chuỗi ký tự');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: ERROR_MESSAGES.VALIDATION_ERROR,
      message: 'Dữ liệu bài học không hợp lệ',
      details: errors
    });
  }

  next();
};

// Validation middleware for result submission
const validateResult = (req, res, next) => {
  const { lessonId, answers, timeTaken, studentInfo } = req.body;
  const errors = [];

  if (!isValidId(lessonId)) {
    errors.push('ID bài học không hợp lệ');
  }

  if (!answers || !Array.isArray(answers)) {
    errors.push('Câu trả lời phải là một mảng');
  }

  if (typeof timeTaken !== 'number' || timeTaken < 0) {
    errors.push('Thời gian làm bài không hợp lệ');
  }

  if (!studentInfo || typeof studentInfo !== 'object') {
    errors.push('Thông tin học sinh không hợp lệ');
  } else {
    if (!studentInfo.name || !isValidName(studentInfo.name)) {
      errors.push('Tên học sinh không hợp lệ');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: ERROR_MESSAGES.VALIDATION_ERROR,
      message: 'Dữ liệu kết quả không hợp lệ',
      details: errors
    });
  }

  next();
};

// Validation middleware for pagination parameters
const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;
  
  if (page !== undefined) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        error: ERROR_MESSAGES.VALIDATION_ERROR,
        message: 'Số trang phải là số nguyên dương'
      });
    }
    req.query.page = pageNum;
  }

  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: ERROR_MESSAGES.VALIDATION_ERROR,
        message: 'Giới hạn phải là số từ 1 đến 100'
      });
    }
    req.query.limit = limitNum;
  }

  next();
};

// Validation middleware for ID parameters
const validateIdParam = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!isValidId(id)) {
      return res.status(400).json({
        error: ERROR_MESSAGES.VALIDATION_ERROR,
        message: `${paramName} không hợp lệ`
      });
    }

    next();
  };
};

// Validation middleware for file uploads
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      error: ERROR_MESSAGES.VALIDATION_ERROR,
      message: 'Không có file được tải lên'
    });
  }

  next();
};

// Validation middleware for search parameters
const validateSearch = (req, res, next) => {
  const { search, sort } = req.query;
  
  if (search !== undefined && typeof search !== 'string') {
    return res.status(400).json({
      error: ERROR_MESSAGES.VALIDATION_ERROR,
      message: 'Từ khóa tìm kiếm phải là chuỗi ký tự'
    });
  }

  if (sort !== undefined) {
    const validSorts = ['newest', 'oldest', 'az', 'za', 'newest-changed', 'popular', 'order'];
    if (!validSorts.includes(sort)) {
      return res.status(400).json({
        error: ERROR_MESSAGES.VALIDATION_ERROR,
        message: 'Kiểu sắp xếp không hợp lệ'
      });
    }
  }

  next();
};

// Generic validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];
      
      for (const rule of rules) {
        if (!rule.validator(value)) {
          errors.push(rule.message);
          break;
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: ERROR_MESSAGES.VALIDATION_ERROR,
        message: 'Dữ liệu không hợp lệ',
        details: errors
      });
    }

    next();
  };
};

module.exports = {
  validateStudentRegistration,
  validateStudentLogin,
  validateAdminLogin,
  validateLesson,
  validateResult,
  validatePagination,
  validateIdParam,
  validateFileUpload,
  validateSearch,
  validate,
  // Export validation helpers for reuse
  isValidPhoneNumber,
  isValidPassword,
  isValidName,
  isValidDate,
  isValidEmail,
  isValidId
};
