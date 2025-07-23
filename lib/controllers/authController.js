const authService = require('../services/authService');
const sessionService = require('../services/sessionService');
const { asyncHandler, AuthenticationError, ValidationError } = require('../middleware/errorHandler');
const { SUCCESS_MESSAGES } = require('../config/constants');
const { isValidPassword } = require('../middleware/validation');

class AuthController {
  // Admin login
  adminLogin = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const result = await authService.authenticateAdmin(username, password);
    
    // Regenerate session ID to prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration failed:', err);
        throw new Error('Session regeneration failed');
      }
      
      // Set admin session
      sessionService.setAdminSession(req);
      
      res.json({
        success: true,
        message: result.message,
        user: { type: 'admin', username }
      });
    });
  });

  // Student login
  studentLogin = asyncHandler(async (req, res) => {
    const { phone_number, password } = req.body;
    const deviceIdentifier = req.headers['x-device-id'] || req.body.deviceId;

    // Debug logging
    console.log('[Auth Debug] Student login attempt:', {
      endpoint: '/api/auth/student/login',
      phone: phone_number?.substring(0, 3) + '***',
      hasDeviceId: !!deviceIdentifier,
      sessionId: req.sessionID
    });

    const result = await authService.authenticateStudent(phone_number, password, deviceIdentifier);
    
    // Regenerate session ID to prevent session fixation
    req.session.regenerate(async (err) => {
      if (err) {
        console.error('Session regeneration failed:', err);
        throw new Error('Session regeneration failed');
      }
      
      // Handle session management
      await sessionService.terminateExistingSessions(result.student.id, req.sessionID);
      
      // Set student session
      sessionService.setStudentSession(req, result.student);
      
      // Update student session in database
      await sessionService.updateStudentSession(result.student.id, req.sessionID, deviceIdentifier);
      
      console.log('[Auth Debug] Student login successful:', {
        studentId: result.student.id,
        studentName: result.student.name,
        sessionId: req.sessionID
      });
      
      res.json({
        success: true,
        message: result.message,
        user: {
          type: 'student',
          id: result.student.id,
          name: result.student.name
        }
      });
    });
  });

  // Student registration
  studentRegister = asyncHandler(async (req, res) => {
    const result = await authService.registerStudent(req.body);
    
    res.status(201).json({
      success: true,
      message: result.message,
      studentId: result.studentId
    });
  });

  // Logout (both admin and student)
  logout = asyncHandler(async (req, res) => {
    const sessionData = sessionService.getSessionData(req);
    
    // Clear student session in database if student
    if (sessionData.studentId) {
      await sessionService.clearStudentSession(sessionData.studentId);
    }
    
    // Destroy session
    sessionService.destroySession(req, (err) => {
      if (err) {
        console.error('Error destroying session:', err);
        throw new Error('Logout failed');
      }
      
      res.json({
        success: true,
        message: SUCCESS_MESSAGES.LOGOUT_SUCCESS
      });
    });
  });

  // Check authentication status
  checkAuth = asyncHandler(async (req, res) => {
    const sessionData = sessionService.getSessionData(req);
    
    if (sessionData.isAuthenticated) {
      res.json({
        success: true,
        data: {
          authenticated: true,
          user: {
            type: 'admin'
          }
        }
      });
    } else if (sessionData.studentId) {
      res.json({
        success: true,
        data: {
          authenticated: true,
          user: {
            type: 'student',
            id: sessionData.studentId,
            name: sessionData.studentName
          }
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          authenticated: false
        }
      });
    }
  });

  // Refresh session
  refreshSession = asyncHandler(async (req, res) => {
    const sessionData = sessionService.getSessionData(req);
    
    if (!sessionData.isAuthenticated && !sessionData.studentId) {
      throw new AuthenticationError('No active session to refresh');
    }
    
    // Save session to extend expiry
    sessionService.saveSession(req, (err) => {
      if (err) {
        console.error('Error refreshing session:', err);
        throw new Error('Session refresh failed');
      }
      
      res.json({
        success: true,
        message: 'Session refreshed successfully',
        user: sessionData.isAuthenticated ? 
          { type: 'admin' } : 
          { type: 'student', id: sessionData.studentId, name: sessionData.studentName }
      });
    });
  });

  // Change password (for students)
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const sessionData = sessionService.getSessionData(req);
    
    if (!sessionData.studentId) {
      throw new AuthenticationError('Student authentication required');
    }

    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current password and new password are required');
    }

    if (!isValidPassword(newPassword)) {
      throw new ValidationError('New password must be at least 8 characters long and contain uppercase, lowercase, number, and special characters');
    }

    // Call authService to change password (this will clear all sessions)
    await authService.changeStudentPassword(sessionData.studentId, currentPassword, newPassword);

    // Destroy current session to force re-login
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session after password change:', err);
      }
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again with your new password.'
    });
  });

  // Logout from all devices
  logoutAllDevices = asyncHandler(async (req, res) => {
    const sessionData = sessionService.getSessionData(req);
    
    if (!sessionData.studentId) {
      throw new AuthenticationError('Student authentication required');
    }

    // Clear all sessions for this student
    await sessionService.clearStudentSessions(sessionData.studentId);

    // Destroy current session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
    });

    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  });

  // Validate device
  validateDevice = asyncHandler(async (req, res) => {
    const { deviceId } = req.body;
    const sessionData = sessionService.getSessionData(req);
    
    if (!sessionData.studentId) {
      throw new AuthenticationError('Student authentication required');
    }

    if (!deviceId) {
      throw new ValidationError('Device ID is required');
    }

    // This would validate the device against the stored device info
    // For now, just return success
    res.json({
      success: true,
      message: 'Device validated successfully',
      deviceId
    });
  });

  // Get session info
  getSessionInfo = asyncHandler(async (req, res) => {
    const sessionData = sessionService.getSessionData(req);
    
    res.json({
      success: true,
      data: {
        sessionId: sessionData.sessionId,
        authenticated: sessionData.isAuthenticated || !!sessionData.studentId,
        user: sessionData.isAuthenticated ? 
          { type: 'admin' } : 
          sessionData.studentId ? 
            { type: 'student', id: sessionData.studentId, name: sessionData.studentName } : 
            null
      }
    });
  });

  // Admin check endpoint
  checkAdminAuth = asyncHandler(async (req, res) => {
    const isAdmin = sessionService.isAdminAuthenticated(req);
    
    res.json({
      success: true,
      data: {
        isAdmin,
        authenticated: isAdmin
      }
    });
  });

  // Student check endpoint (also accepts admin with student privileges)
  checkStudentAuth = asyncHandler(async (req, res) => {
    const sessionData = sessionService.getSessionData(req);
    const isStudent = !!sessionData.studentId;
    const isAdmin = sessionService.isAdminAuthenticated(req);
    const hasStudentAccess = sessionService.isStudentOrAdminAuthenticated(req);

    // Debug logging
    console.log('[Auth Debug] Student check:', {
      endpoint: '/api/auth/student/check',
      sessionId: req.sessionID,
      studentId: sessionData.studentId,
      studentName: sessionData.studentName,
      isStudent,
      isAdmin,
      hasStudentAccess,
      headers: {
        'x-device-id': req.headers['x-device-id']
      }
    });

    // For admin users, provide a mock student object for compatibility
    const studentData = isStudent ? {
      id: sessionData.studentId,
      name: sessionData.studentName
    } : isAdmin ? {
      id: 'admin',
      name: 'Administrator'
    } : null;

    res.json({
      success: true,
      data: {
        isStudent: hasStudentAccess, // Return true for both students and admins
        authenticated: hasStudentAccess,
        isAuthenticated: hasStudentAccess, // Add this for client compatibility
        student: studentData
      }
    });
  });
}

module.exports = new AuthController();
