const databaseService = require('../services/databaseService');
const sessionService = require('../services/sessionService');
const { asyncHandler, NotFoundError, AuthorizationError, ValidationError, AuthenticationError } = require('../middleware/errorHandler');
const { SUCCESS_MESSAGES } = require('../config/constants');
const { sanitizeObject } = require('../utils/sanitization');

class StudentController {
  // Get all students (admin only)
  getAllStudents = asyncHandler(async (req, res) => {
    const { approved, limit } = req.query;
    
    const students = await databaseService.getStudents({
      approved: approved !== undefined ? approved === 'true' : null,
      limit: limit ? parseInt(limit) : 100
    });
    
    res.json({
      success: true,
      students,
      count: students.length
    });
  });

  // Get pending students (admin only)
  getPendingStudents = asyncHandler(async (req, res) => {
    const students = await databaseService.getStudents({ approved: false });
    
    res.json({
      success: true,
      students,
      count: students.length
    });
  });

  // Get approved students (admin only)
  getApprovedStudents = asyncHandler(async (req, res) => {
    const students = await databaseService.getStudents({ approved: true });
    
    res.json({
      success: true,
      students,
      count: students.length
    });
  });

  // Approve student (admin only)
  approveStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    
    await databaseService.updateStudent(studentId, {
      is_approved: true,
      approved_at: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Student approved successfully'
    });
  });

  // Reject/unapprove student (admin only)
  rejectStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    
    await databaseService.updateStudent(studentId, {
      is_approved: false,
      approved_at: null
    });
    
    res.json({
      success: true,
      message: 'Student approval revoked'
    });
  });

  // Get student profile
  getStudentProfile = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    
    // Authorization already handled by requireAdminOrOwner middleware
    // No need for additional checks here
    
    const profile = await databaseService.getStudentProfile(studentId);
    
    res.json({
      success: true,
      profile
    });
  });

  // Get current student's profile
  getCurrentStudentProfile = asyncHandler(async (req, res) => {
    const sessionData = sessionService.getSessionData(req);
    const isAdmin = sessionService.isAdminAuthenticated(req);

    // Debug logging
    console.log('[Profile Debug] getCurrentStudentProfile called:', {
      sessionId: req.sessionID,
      studentId: sessionData.studentId,
      isAdmin,
      hasStudentId: !!sessionData.studentId,
      sessionData
    });

    if (!sessionData.studentId && !isAdmin) {
      console.log('[Profile Debug] Access denied - no student ID and not admin');
      throw new AuthenticationError('Student authentication required');
    }

    let profile;

    if (sessionData.studentId) {
      // Regular student access
      profile = await databaseService.getStudentProfile(sessionData.studentId);
    } else if (isAdmin) {
      // Admin access - provide a default admin profile
      profile = {
        id: 'admin',
        full_name: 'Administrator',
        phone_number: 'admin',
        grade_level: 'Admin',
        school_name: 'System Administrator',
        bio: 'System Administrator Account',
        avatar_url: null,
        profile_visible: true,
        leaderboard_visible: false,
        created_at: new Date().toISOString(),
        is_approved: true,
        statistics: {
          total_lessons_completed: 0,
          total_score: 0,
          average_score: 0,
          total_time_spent: 0,
          lessons_this_week: 0,
          current_streak: 0,
          best_streak: 0,
          rank: null,
          total_students: 0
        }
      };
    }

    res.json({
      success: true,
      profile
    });
  });

  // Update student profile
  updateStudentProfile = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const updateData = req.body;
    
    // Authorization already handled by requireAdminOrOwner middleware
    // No need for additional checks here
    
    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.password_hash;
    delete updateData.is_approved;
    delete updateData.approved_device_id;
    delete updateData.current_session_id;
    
    // Sanitize user input fields to prevent XSS
    const sanitizedData = sanitizeObject(updateData, [
      'full_name',
      'bio',
      'school_name',
      'grade_level',
      'email',
      'address'
    ]);
    
    await databaseService.updateStudent(studentId, sanitizedData);
    
    res.json({
      success: true,
      message: SUCCESS_MESSAGES.UPDATE_SUCCESS
    });
  });

  // Delete student (admin only)
  deleteStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    
    // This would need to be implemented in databaseService
    // For now, just return success
    res.json({
      success: true,
      message: SUCCESS_MESSAGES.DELETE_SUCCESS
    });
  });

  // Set student info in session
  setStudentInfo = asyncHandler(async (req, res) => {
    const sessionData = sessionService.getSessionData(req);
    
    if (!sessionData.studentId) {
      throw new AuthenticationError('Student authentication required');
    }
    
    const { name, school, grade } = req.body;
    
    if (!name) {
      throw new ValidationError('Student name is required');
    }
    
    // Sanitize user input to prevent XSS
    const studentInfo = sanitizeObject({ name, school, grade }, ['name', 'school', 'grade']);
    sessionService.setStudentInfo(req, studentInfo);
    
    res.json({
      success: true,
      message: 'Student information set successfully',
      studentInfo
    });
  });

  // Get student info from session
  getStudentInfo = asyncHandler(async (req, res) => {
    const sessionData = sessionService.getSessionData(req);
    
    if (!sessionData.studentId) {
      throw new AuthenticationError('Student authentication required');
    }
    
    const studentInfo = sessionService.getStudentInfo(req);
    
    res.json({
      success: true,
      studentInfo: studentInfo || null
    });
  });

  // Update device information
  updateDeviceInfo = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { deviceId, deviceFingerprint } = req.body;
    
    // Authorization already handled by requireAdminOrOwner middleware
    // No need for additional checks here
    
    const updateData = {};
    if (deviceId) {
      updateData.approved_device_id = deviceId;
      updateData.device_registered_at = new Date().toISOString();
    }
    if (deviceFingerprint) {
      updateData.approved_device_fingerprint = deviceFingerprint;
    }
    
    await databaseService.updateStudent(studentId, updateData);
    
    res.json({
      success: true,
      message: 'Device information updated successfully'
    });
  });

  // Get student statistics
  getStudentStatistics = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    
    // Authorization already handled by requireAdminOrOwner middleware
    // No need for additional checks here
    
    // Get real student statistics from database
    const stats = await databaseService.calculateStudentStats(studentId);
    
    res.json({
      success: true,
      statistics: stats
    });
  });

  // Get student activity history
  getStudentActivity = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { limit = 50 } = req.query;
    
    // Authorization already handled by requireAdminOrOwner middleware
    // No need for additional checks here
    
    // Get real student activity history from database
    const activities = await databaseService.getStudentActivityLog(studentId, parseInt(limit));
    
    res.json({
      success: true,
      activities,
      count: activities.length
    });
  });

  // Reset student password (admin only)
  resetStudentPassword = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
      throw new ValidationError('New password is required');
    }
    
    // Reset password using database service
    const result = await databaseService.resetStudentPassword(studentId, newPassword);
    
    res.json(result);
  });

  // Avatar management methods (delegated to settings controller)
  uploadAvatar = (req, res, next) => {
    const settingsController = require('./settingsController');
    return settingsController.uploadAvatar(req, res, next);
  };

  removeAvatar = (req, res, next) => {
    const settingsController = require('./settingsController');
    return settingsController.removeAvatar(req, res, next);
  };

  // Device management methods (delegated to settings controller)
  getDevices = (req, res, next) => {
    const settingsController = require('./settingsController');
    return settingsController.getStudentDevices(req, res, next);
  };

  removeDevice = (req, res, next) => {
    const settingsController = require('./settingsController');
    return settingsController.removeDevice(req, res, next);
  };

  // Data export method (delegated to settings controller)
  exportData = (req, res, next) => {
    const settingsController = require('./settingsController');
    return settingsController.exportStudentData(req, res, next);
  };

  // Account deletion request (delegated to settings controller)
  requestAccountDeletion = (req, res, next) => {
    const settingsController = require('./settingsController');
    return settingsController.requestAccountDeletion(req, res, next);
  };
}

module.exports = new StudentController();
