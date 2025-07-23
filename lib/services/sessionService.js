const databaseService = require('./databaseService');
const encryptionService = require('./encryptionService');
const logger = require('../utils/logger');

class SessionService {
  constructor() {
    this.sessionStore = null; // Initialize as null
    this.studentCache = new Map(); // Cache for student data to reduce DB queries
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache timeout
  }

  // Initialize session service with session store
  initialize(sessionStore) {
    this.sessionStore = sessionStore;
    
    // Set up cache cleanup interval
    setInterval(() => {
      this.cleanupCache();
    }, this.cacheTimeout);
  }

  // Cache management methods
  getCachedStudent(studentId) {
    const cached = this.studentCache.get(studentId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedStudent(studentId, studentData) {
    this.studentCache.set(studentId, {
      data: studentData,
      timestamp: Date.now()
    });
  }

  clearStudentCache(studentId) {
    this.studentCache.delete(studentId);
  }

  cleanupCache() {
    const now = Date.now();
    for (const [studentId, cached] of this.studentCache.entries()) {
      if (now - cached.timestamp > this.cacheTimeout) {
        this.studentCache.delete(studentId);
      }
    }
  }

  // Terminate existing sessions for a student (single session enforcement)
  async terminateExistingSessions(studentId, currentSessionId) {
    try {
      // Try to get student data from cache first
      let studentData = this.getCachedStudent(studentId);
      
      if (!studentData) {
        // Get student's current session ID from database using databaseService
        studentData = await databaseService.getStudentById(studentId);
        
        if (!studentData) {
          console.error('Student not found:', studentId);
          return;
        }
        
        // Cache the student data for future use
        this.setCachedStudent(studentId, studentData);
      }

      if (studentData.current_session_id && studentData.current_session_id !== currentSessionId) {
        // Destroy the previous session (new login gets priority)
        console.log(`🔄 Single session enforcement: Terminating previous session ${studentData.current_session_id} for student ${studentId} (new session: ${currentSessionId})`);
        
        this.sessionStore.destroy(studentData.current_session_id, (err) => {
          if (err) {
            console.error('❌ Error destroying previous session:', err);
          } else {
            console.log(`✅ Previous session ${studentData.current_session_id} successfully terminated for student ${studentId}`);
          }
        });
      } else if (!studentData.current_session_id) {
        console.log(`📱 First session for student ${studentId}: ${currentSessionId}`);
      } else {
        console.log(`🔄 Session refresh for student ${studentId}: ${currentSessionId}`);
      }
    } catch (error) {
      console.error('Error terminating existing sessions:', error);
    }
  }

  // Update student session information
  async updateStudentSession(studentId, sessionId, deviceIdentifier) {
    const updateData = {
      current_session_id: sessionId,
      last_login_at: new Date().toISOString()
    };

    // Update device information if provided
    if (deviceIdentifier) {
      // More reliable device ID detection - check for UUID format or specific patterns
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceIdentifier);
      const isLongId = deviceIdentifier.length > 20;
      
      if (isUUID || isLongId) {
        updateData.approved_device_id = deviceIdentifier;
        updateData.device_registered_at = new Date().toISOString();
      } else {
        // Legacy fingerprint support
        updateData.approved_device_fingerprint = deviceIdentifier;
      }
    }

    await databaseService.updateStudent(studentId, updateData);
    
    // Clear cache since student data has been updated
    this.clearStudentCache(studentId);
    
    return true;
  }

  // Clear student session
  async clearStudentSession(studentId) {
    await databaseService.updateStudent(studentId, {
      current_session_id: null
    });
    
    // Clear cache since student data has been updated
    this.clearStudentCache(studentId);
    
    return true;
  }

  // Get session data
  getSessionData(req) {
    // Safety check for request and session
    if (!req || !req.session) {
      return {
        sessionId: null,
        isAuthenticated: false,
        studentId: null,
        studentName: null,
        studentInfo: null
      };
    }

    return {
      sessionId: req.sessionID || null,
      isAuthenticated: req.session.isAuthenticated || false,
      studentId: req.session.studentId || null,
      studentName: req.session.studentName || null,
      studentInfo: req.session.studentInfo || null
    };
  }

  // Set admin session
  setAdminSession(req) {
    req.session.isAuthenticated = true;
    // Clear any student-related session data
    delete req.session.studentId;
    delete req.session.studentName;
    delete req.session.studentInfo;

    // Generate encryption context for admin session
    this.generateEncryptionContext(req);

    // Set admin-specific timeout
    this.setUserSpecificTimeout(req, 'admin');
  }

  // Set student session
  setStudentSession(req, student) {
    req.session.studentId = student.id;
    req.session.studentName = student.name;
    // Clear admin session data
    delete req.session.isAuthenticated;

    // Generate encryption context for student session
    this.generateEncryptionContext(req);

    // Set student-specific timeout
    this.setUserSpecificTimeout(req, 'student');
  }

  // Clear all session data
  clearSession(req) {
    delete req.session.isAuthenticated;
    delete req.session.studentId;
    delete req.session.studentName;
    delete req.session.studentInfo;
    delete req.session.encryptionContext;
  }

  // Destroy session completely
  destroySession(req, callback) {
    req.session.destroy(callback);
  }

  // Save session explicitly
  saveSession(req, callback) {
    req.session.save(callback);
  }

  // Check if user is authenticated admin
  isAdminAuthenticated(req) {
    return req.session && req.session.isAuthenticated === true;
  }

  // Check if user is authenticated student
  isStudentAuthenticated(req) {
    return req.session && req.session.studentId;
  }

  // Check if admin should have student privileges (admin-as-student mode)
  adminHasStudentPrivileges(req) {
    return this.isAdminAuthenticated(req);
  }

  // Enhanced student authentication check that includes admin privileges
  isStudentOrAdminAuthenticated(req) {
    return this.isStudentAuthenticated(req) || this.adminHasStudentPrivileges(req);
  }

  // Check if student has required info
  hasStudentInfo(req) {
    return req.session && req.session.studentInfo;
  }

  // Set student info
  setStudentInfo(req, studentInfo) {
    req.session.studentInfo = studentInfo;
  }

  // Get student info
  getStudentInfo(req) {
    return req.session.studentInfo;
  }

  // Validate session integrity
  validateSessionIntegrity(req) {
    const session = req.session;

    // Check for conflicting session states
    if (session.isAuthenticated && session.studentId) {
      console.warn('❌ Session integrity issue: Both admin and student authentication present');
      return false;
    }

    // Check for required session data consistency
    if (session.studentId && !session.studentName) {
      console.warn('❌ Session integrity issue: Student ID present but name missing');
      return false;
    }

    return true;
  }

  // Clean up invalid session data
  cleanupSession(req) {
    if (!this.validateSessionIntegrity(req)) {
      console.log('🧹 Cleaning up invalid session data for session:', req.sessionID);
      this.clearSession(req);
    }
  }

  // Import session utilities
  getSessionTimeout() {
    const { getSessionTimeout } = require('../config/session');
    return getSessionTimeout();
  }

  // Extend session on activity
  extendSessionOnActivity(req, customTimeout = null) {
    if (req.session && req.session.cookie) {
      const timeout = customTimeout || this.getSessionTimeout();
      req.session.cookie.maxAge = timeout;
      req.session.touch(); // Mark as active
      
      // Log session extension
      console.log(`🔄 Session extended for ${req.sessionID} - New timeout: ${timeout}ms`);
    }
  }

  // Set different timeouts for different user types
  setUserSpecificTimeout(req, userType) {
    if (!req.session) return;
    
    let timeoutHours;
    switch (userType) {
      case 'admin':
        timeoutHours = parseInt(process.env.ADMIN_SESSION_TIMEOUT_HOURS) || 24;
        break;
      case 'student':
        timeoutHours = parseInt(process.env.STUDENT_SESSION_TIMEOUT_HOURS) || 8;
        break;
      default:
        timeoutHours = parseInt(process.env.SESSION_TIMEOUT_HOURS) || 24;
    }
    
    const timeout = timeoutHours * 60 * 60 * 1000;
    req.session.cookie.maxAge = timeout;
    
    console.log(`⏱️ Session timeout set for ${userType}: ${timeoutHours} hours`);
  }

  // Check if session is about to expire
  isSessionNearExpiry(req, warningThresholdMinutes = 30) {
    if (!req.session || !req.session.cookie.maxAge) return false;
    
    const remainingTime = req.session.cookie.maxAge;
    const warningThreshold = warningThresholdMinutes * 60 * 1000;
    
    return remainingTime < warningThreshold;
  }

  // Get session time remaining
  getSessionTimeRemaining(req) {
    if (!req.session || !req.session.cookie.maxAge) return 0;
    return req.session.cookie.maxAge;
  }

  // Manual session refresh
  refreshSession(req, callback) {
    if (req.session) {
      this.extendSessionOnActivity(req);
      req.session.save(callback);
    } else if (callback) {
      callback(new Error('No session to refresh'));
    }
  }

  // Clear all sessions for a specific student
  async clearStudentSessions(studentId) {
    if (!this.sessionStore) {
      console.warn('Session store not initialized');
      return;
    }

    try {
      // Get all session IDs from the store
      const self = this;
      return new Promise((resolve, reject) => {
        this.sessionStore.all((err, sessions) => {
          if (err) {
            reject(err);
            return;
          }

          if (!sessions) {
            resolve();
            return;
          }

          const sessionIds = Object.keys(sessions);
          let destroyCount = 0;
          let totalToDestroy = 0;

          // Count sessions to destroy
          sessionIds.forEach(sessionId => {
            const session = sessions[sessionId];
            if (session && session.studentId === studentId) {
              totalToDestroy++;
            }
          });

          if (totalToDestroy === 0) {
            resolve();
            return;
          }

          // Destroy matching sessions
          sessionIds.forEach(sessionId => {
            const session = sessions[sessionId];
            if (session && session.studentId === studentId) {
              this.sessionStore.destroy(sessionId, (destroyErr) => {
                if (destroyErr) {
                  console.error('Error destroying session:', destroyErr);
                }
                destroyCount++;
                if (destroyCount === totalToDestroy) {
                  // Clear student cache
                  self.clearStudentCache(studentId);
                  resolve();
                }
              });
            }
          });
        });
      });
    } catch (error) {
      console.error('Error clearing student sessions:', error);
      throw error;
    }
  }

  // Generate encryption context for session
  generateEncryptionContext(req) {
    if (!req.session) {
      console.warn('⚠️ Cannot generate encryption context: no session available');
      return null;
    }

    try {
      const sessionSecret = req.session.id || 'fallback-secret';
      const context = encryptionService.generateSessionContext(req.sessionID, sessionSecret);

      req.session.encryptionContext = context;

      logger.encryption(`Generated encryption context for session: ${req.sessionID}`);
      return context;
    } catch (error) {
      console.error('❌ Failed to generate encryption context:', error);
      return null;
    }
  }

  // Get encryption context from session
  getEncryptionContext(req) {
    if (!req.session || !req.session.encryptionContext) {
      return null;
    }

    const context = req.session.encryptionContext;

    // Validate context age
    if (!encryptionService.isContextValid(context)) {
      console.log('🔑 Encryption context expired, regenerating...');
      return this.generateEncryptionContext(req);
    }

    return context;
  }

  // Rotate encryption key for session
  rotateEncryptionKey(req) {
    const currentContext = this.getEncryptionContext(req);

    if (!currentContext) {
      console.log('🔄 No existing context, generating new one');
      return this.generateEncryptionContext(req);
    }

    try {
      const sessionSecret = req.session.id || 'fallback-secret';
      const newContext = encryptionService.rotateSessionKey(currentContext, sessionSecret);

      req.session.encryptionContext = newContext;

      console.log(`🔄 Rotated encryption key for session: ${req.sessionID}`);
      return newContext;
    } catch (error) {
      console.error('❌ Failed to rotate encryption key:', error);
      return currentContext; // Return old context if rotation fails
    }
  }

  // Check if session has valid encryption context
  hasValidEncryptionContext(req) {
    const context = this.getEncryptionContext(req);
    return context !== null;
  }

  // Clear encryption context
  clearEncryptionContext(req) {
    if (req.session && req.session.encryptionContext) {
      delete req.session.encryptionContext;
      console.log(`🗑️ Cleared encryption context for session: ${req.sessionID}`);
    }
  }
}

module.exports = new SessionService();
