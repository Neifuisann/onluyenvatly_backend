const bcrypt = require('bcrypt');
const { ADMIN_CREDENTIALS, ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../config/constants');
const databaseService = require('./databaseService');
const sessionService = require('./sessionService');

class AuthService {
  // Admin authentication
  async authenticateAdmin(username, password) {
    if (!username || !password) {
      throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
    }

    const credentialsMatch = username === ADMIN_CREDENTIALS.username &&
      await bcrypt.compare(password, ADMIN_CREDENTIALS.password);

    if (!credentialsMatch) {
      throw new Error('Invalid credentials');
    }

    return { success: true, message: SUCCESS_MESSAGES.LOGIN_SUCCESS };
  }

  // Student authentication
  async authenticateStudent(phoneNumber, password, deviceIdentifier) {
    if (!phoneNumber || !password) {
      throw new Error('Missing phone number or password');
    }

    if (!deviceIdentifier) {
      throw new Error('Không thể xác định thiết bị. Vui lòng thử lại.');
    }

    // Get student from database
    const student = await databaseService.getStudentByPhone(phoneNumber);

    if (!student) {
      throw new Error('Tài khoản không tồn tại.');
    }

    if (!student.is_approved) {
      throw new Error('Tài khoản của bạn đang chờ được giáo viên phê duyệt.');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, student.password_hash);
    if (!passwordMatch) {
      throw new Error('Mật khẩu không chính xác.');
    }

    // Check device ID/fingerprint if already set
    const approvedDevice = student.approved_device_id || student.approved_device_fingerprint;
    const isDeviceCheckEnabled = process.env.STRICT_DEVICE_CHECK !== 'false';

    if (approvedDevice && approvedDevice !== deviceIdentifier && isDeviceCheckEnabled) {
      console.log(`🔒 Device mismatch for student ${student.id}: stored=${approvedDevice.substring(0,8)}..., provided=${deviceIdentifier.substring(0,8)}...`);
      throw new Error('Bạn chỉ có thể đăng nhập từ thiết bị đã đăng ký trước đó. Vui lòng liên hệ giáo viên để thay đổi thiết bị.');
    } else if (approvedDevice && approvedDevice !== deviceIdentifier) {
      console.log(`⚠️  Device mismatch detected but allowing login (strict check disabled): student=${student.id}`);
    }

    return {
      success: true,
      student: {
        id: student.id,
        name: student.full_name
      },
      deviceIdentifier,
      message: SUCCESS_MESSAGES.LOGIN_SUCCESS
    };
  }

  // Student registration
  async registerStudent(studentData) {
    const { full_name, date_of_birth, phone_number, password } = studentData;

    if (!full_name || !phone_number || !password) {
      throw new Error('Missing required fields');
    }

    // Check if phone number is already registered
    const existingUser = await databaseService.getStudentByPhone(phone_number);
    if (existingUser) {
      throw new Error('Số điện thoại này đã được đăng ký. Vui lòng sử dụng số điện thoại khác.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new student record
    const newStudent = await databaseService.createStudent({
      full_name,
      phone_number,
      date_of_birth,
      password_hash: hashedPassword
    });

    return {
      success: true,
      message: SUCCESS_MESSAGES.REGISTRATION_SUCCESS,
      studentId: newStudent.id
    };
  }

  // Password hashing utility
  async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }

  // Password verification utility
  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Generate secure session data
  generateSessionData(user, type = 'student') {
    const sessionData = {
      timestamp: new Date().toISOString()
    };

    if (type === 'admin') {
      sessionData.isAuthenticated = true;
    } else if (type === 'student') {
      sessionData.studentId = user.id;
      sessionData.studentName = user.name;
    }

    return sessionData;
  }

  // Validate session data
  validateSession(session, type = 'student') {
    if (type === 'admin') {
      return session && session.isAuthenticated === true;
    } else if (type === 'student') {
      return session && session.studentId && session.studentName;
    }
    return false;
  }

  // Change student password
  async changeStudentPassword(studentId, currentPassword, newPassword) {
    if (!studentId || !currentPassword || !newPassword) {
      throw new Error('Missing required parameters');
    }

    // Get student from database
    const student = await databaseService.getStudentById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, student.password_hash);
    if (!passwordMatch) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    await databaseService.updateStudent(studentId, {
      password_hash: newPasswordHash
    });

    // Clear all sessions for this student to force re-authentication
    // This ensures that any existing sessions become invalid after password change
    try {
      await sessionService.clearStudentSessions(studentId);
    } catch (error) {
      console.error('Error clearing student sessions after password change:', error);
      // Don't fail the password change if session clearing fails
    }

    return { success: true, message: 'Password changed successfully' };
  }
}

module.exports = new AuthService();
