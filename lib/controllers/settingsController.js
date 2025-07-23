const databaseService = require('../services/databaseService');
const sessionService = require('../services/sessionService');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { asyncHandler, NotFoundError, AuthorizationError, ValidationError, AuthenticationError } = require('../middleware/errorHandler');
const { SUCCESS_MESSAGES, UPLOAD_CONFIG } = require('../config/constants');
const { sanitizeObject } = require('../utils/sanitization');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/uploads/avatars');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const studentId = req.session?.student?.id || 'unknown';
    const ext = path.extname(file.originalname);
    const filename = `avatar-${studentId}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new ValidationError('Chỉ chấp nhận file hình ảnh'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: UPLOAD_CONFIG.maxFileSize || 5 * 1024 * 1024, // 5MB default
  }
});

class SettingsController {
  // Get student settings
  getStudentSettings = asyncHandler(async (req, res) => {
    const studentId = req.session?.student?.id;
    if (!studentId) {
      throw new AuthenticationError('Không tìm thấy thông tin đăng nhập');
    }

    try {
      // Get settings from database
      const result = await databaseService.query(
        'SELECT settings_data FROM student_settings WHERE student_id = $1',
        [studentId]
      );

      const settings = result.rows[0]?.settings_data || {};

      res.json({
        success: true,
        settings
      });
    } catch (error) {
      // If settings table doesn't exist yet, return empty settings
      res.json({
        success: true,
        settings: {}
      });
    }
  });

  // Update student settings
  updateStudentSettings = asyncHandler(async (req, res) => {
    const studentId = req.session?.student?.id;
    if (!studentId) {
      throw new AuthenticationError('Không tìm thấy thông tin đăng nhập');
    }

    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      throw new ValidationError('Dữ liệu cài đặt không hợp lệ');
    }

    try {
      // Upsert settings
      await databaseService.query(`
        INSERT INTO student_settings (student_id, settings_data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (student_id)
        DO UPDATE SET
          settings_data = $2,
          updated_at = CURRENT_TIMESTAMP
      `, [studentId, JSON.stringify(settings)]);

      res.json({
        success: true,
        message: 'Đã cập nhật cài đặt thành công'
      });
    } catch (error) {
      throw new Error('Không thể cập nhật cài đặt');
    }
  });

  // Update privacy settings
  updatePrivacySettings = asyncHandler(async (req, res) => {
    const studentId = req.session?.student?.id;
    if (!studentId) {
      throw new AuthenticationError('Không tìm thấy thông tin đăng nhập');
    }

    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      throw new ValidationError('Dữ liệu cài đặt không hợp lệ');
    }

    // Extract privacy-related settings
    const privacySettings = {
      'public-profile': settings['public-profile'],
      'leaderboard-visible': settings['leaderboard-visible'],
      'progress-visible': settings['progress-visible']
    };

    try {
      // Get current settings
      const result = await databaseService.query(
        'SELECT settings_data FROM student_settings WHERE student_id = $1',
        [studentId]
      );

      const currentSettings = result.rows[0]?.settings_data || {};
      const updatedSettings = { ...currentSettings, ...privacySettings };

      // Update settings
      await databaseService.query(`
        INSERT INTO student_settings (student_id, settings_data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (student_id)
        DO UPDATE SET
          settings_data = $2,
          updated_at = CURRENT_TIMESTAMP
      `, [studentId, JSON.stringify(updatedSettings)]);

      // Also update student profile visibility
      await databaseService.updateStudent(studentId, {
        profile_visible: privacySettings['public-profile'] !== false,
        leaderboard_visible: privacySettings['leaderboard-visible'] !== false
      });

      res.json({
        success: true,
        message: 'Đã cập nhật cài đặt quyền riêng tư'
      });
    } catch (error) {
      throw new Error('Không thể cập nhật cài đặt quyền riêng tư');
    }
  });

  // Upload avatar
  uploadAvatar = asyncHandler(async (req, res) => {
    const studentId = req.session?.student?.id;
    if (!studentId) {
      throw new AuthenticationError('Không tìm thấy thông tin đăng nhập');
    }

    // Use multer middleware
    upload.single('avatar')(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            throw new ValidationError('File quá lớn. Kích thước tối đa là 5MB');
          }
          throw new ValidationError('Lỗi tải file lên');
        }
        throw err;
      }

      if (!req.file) {
        throw new ValidationError('Không tìm thấy file');
      }

      try {
        // Get current avatar to delete old one
        const currentStudent = await databaseService.getStudentById(studentId);
        const oldAvatarUrl = currentStudent?.avatar_url;

        // Generate new avatar URL
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        // Update student record
        await databaseService.updateStudent(studentId, {
          avatar_url: avatarUrl
        });

        // Delete old avatar file if exists
        if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/avatars/')) {
          const oldFilePath = path.join(__dirname, '../../public', oldAvatarUrl);
          try {
            await fs.unlink(oldFilePath);
          } catch (deleteError) {
            // Ignore file deletion errors
            console.warn('Could not delete old avatar:', deleteError.message);
          }
        }

        res.json({
          success: true,
          message: 'Đã cập nhật ảnh đại diện',
          data: {
            avatar_url: avatarUrl
          }
        });
      } catch (error) {
        // Clean up uploaded file on error
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        throw new Error('Không thể cập nhật ảnh đại diện');
      }
    });
  });

  // Remove avatar
  removeAvatar = asyncHandler(async (req, res) => {
    const studentId = req.session?.student?.id;
    if (!studentId) {
      throw new AuthenticationError('Không tìm thấy thông tin đăng nhập');
    }

    try {
      // Get current avatar
      const currentStudent = await databaseService.getStudentById(studentId);
      const currentAvatarUrl = currentStudent?.avatar_url;

      // Update student record
      await databaseService.updateStudent(studentId, {
        avatar_url: null
      });

      // Delete avatar file if exists
      if (currentAvatarUrl && currentAvatarUrl.startsWith('/uploads/avatars/')) {
        const filePath = path.join(__dirname, '../../public', currentAvatarUrl);
        try {
          await fs.unlink(filePath);
        } catch (deleteError) {
          // Ignore file deletion errors
          console.warn('Could not delete avatar file:', deleteError.message);
        }
      }

      res.json({
        success: true,
        message: 'Đã xóa ảnh đại diện'
      });
    } catch (error) {
      throw new Error('Không thể xóa ảnh đại diện');
    }
  });

  // Get student devices
  getStudentDevices = asyncHandler(async (req, res) => {
    const studentId = req.session?.student?.id;
    if (!studentId) {
      throw new AuthenticationError('Không tìm thấy thông tin đăng nhập');
    }

    try {
      const result = await databaseService.query(`
        SELECT 
          id,
          user_agent,
          ip_address,
          created_at,
          last_activity,
          CASE WHEN id = $2 THEN true ELSE false END as is_current
        FROM student_devices 
        WHERE student_id = $1 
        ORDER BY last_activity DESC
      `, [studentId, req.session.deviceId]);

      const devices = result.rows;

      res.json({
        success: true,
        devices
      });
    } catch (error) {
      // If devices table doesn't exist, return empty array
      res.json({
        success: true,
        devices: []
      });
    }
  });

  // Remove device
  removeDevice = asyncHandler(async (req, res) => {
    const studentId = req.session?.student?.id;
    const { deviceId } = req.params;
    
    if (!studentId) {
      throw new AuthenticationError('Không tìm thấy thông tin đăng nhập');
    }

    if (!deviceId) {
      throw new ValidationError('ID thiết bị không hợp lệ');
    }

    try {
      // Check if device belongs to student
      const result = await databaseService.query(
        'SELECT * FROM student_devices WHERE id = $1 AND student_id = $2',
        [deviceId, studentId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Không tìm thấy thiết bị');
      }

      // Don't allow removing current device
      if (deviceId === req.session.deviceId) {
        throw new ValidationError('Không thể hủy liên kết thiết bị hiện tại');
      }

      // Remove device
      await databaseService.query(
        'DELETE FROM student_devices WHERE id = $1',
        [deviceId]
      );

      // Also invalidate any sessions for this device
      await databaseService.query(
        'DELETE FROM session WHERE sess->>\'deviceId\' = $1',
        [deviceId]
      );

      res.json({
        success: true,
        message: 'Đã hủy liên kết thiết bị'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error('Không thể hủy liên kết thiết bị');
    }
  });

  // Export student data
  exportStudentData = asyncHandler(async (req, res) => {
    const studentId = req.session?.student?.id;
    if (!studentId) {
      throw new AuthenticationError('Không tìm thấy thông tin đăng nhập');
    }

    try {
      // Get student profile
      const student = await databaseService.getStudentById(studentId);
      
      // Get student settings
      const settingsResult = await databaseService.query(
        'SELECT settings_data FROM student_settings WHERE student_id = $1',
        [studentId]
      );

      // Get student results
      const resultsResult = await databaseService.query(`
        SELECT 
          r.*,
          l.title as lesson_title
        FROM results r
        LEFT JOIN lessons l ON r.lesson_id = l.id
        WHERE r.student_id = $1
        ORDER BY r.created_at DESC
      `, [studentId]);

      // Get rating history
      const ratingResult = await databaseService.query(`
        SELECT * FROM rating_history
        WHERE student_id = $1
        ORDER BY timestamp DESC
      `, [studentId]);

      const exportData = {
        profile: {
          id: student.id,
          full_name: student.full_name,
          phone_number: student.phone_number,
          school_name: student.school_name,
          grade_level: student.grade_level,
          bio: student.bio,
          created_at: student.created_at,
          last_login_at: student.last_login_at
        },
        settings: settingsResult.rows[0]?.settings_data || {},
        results: resultsResult.rows,
        rating_history: ratingResult.rows,
        exported_at: new Date().toISOString()
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="du-lieu-hoc-tap-${studentId}-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(exportData);
    } catch (error) {
      throw new Error('Không thể xuất dữ liệu');
    }
  });

  // Request account deletion
  requestAccountDeletion = asyncHandler(async (req, res) => {
    const studentId = req.session?.student?.id;
    if (!studentId) {
      throw new AuthenticationError('Không tìm thấy thông tin đăng nhập');
    }

    try {
      // Check if deletion request already exists
      const existingRequest = await databaseService.query(
        'SELECT * FROM account_deletion_requests WHERE student_id = $1 AND status = $2',
        [studentId, 'pending']
      );

      if (existingRequest.rows.length > 0) {
        throw new ValidationError('Đã có yêu cầu xóa tài khoản đang chờ xử lý');
      }

      // Create deletion request
      await databaseService.query(`
        INSERT INTO account_deletion_requests (student_id, requested_at, status)
        VALUES ($1, CURRENT_TIMESTAMP, 'pending')
      `, [studentId]);

      res.json({
        success: true,
        message: 'Đã gửi yêu cầu xóa tài khoản. Quản trị viên sẽ xử lý trong vòng 24h.'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error('Không thể gửi yêu cầu xóa tài khoản');
    }
  });

  // Logout from all devices
  logoutAllDevices = asyncHandler(async (req, res) => {
    const studentId = req.session?.student?.id;
    if (!studentId) {
      throw new AuthenticationError('Không tìm thấy thông tin đăng nhập');
    }

    try {
      // Clear all sessions for this student
      await sessionService.clearStudentSessions(studentId);

      // Clear current session
      req.session.destroy();

      res.json({
        success: true,
        message: 'Đã đăng xuất khỏi tất cả thiết bị'
      });
    } catch (error) {
      throw new Error('Không thể đăng xuất khỏi tất cả thiết bị');
    }
  });

  // Get usage statistics
  getUsageStatistics = asyncHandler(async (req, res) => {
    const studentId = req.session?.student?.id;
    if (!studentId) {
      throw new AuthenticationError('Không tìm thấy thông tin đăng nhập');
    }

    try {
      // Get lessons completed
      const lessonsResult = await databaseService.query(
        'SELECT COUNT(DISTINCT lesson_id) as count FROM results WHERE student_id = $1',
        [studentId]
      );

      // Get total study time (approximate based on results)
      const timeResult = await databaseService.query(`
        SELECT 
          COUNT(*) as total_attempts,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_time_per_attempt
        FROM results 
        WHERE student_id = $1
      `, [studentId]);

      // Get achievements count (if achievements table exists)
      let achievementsCount = 0;
      try {
        const achievementsResult = await databaseService.query(
          'SELECT COUNT(*) as count FROM student_achievements WHERE student_id = $1',
          [studentId]
        );
        achievementsCount = achievementsResult.rows[0]?.count || 0;
      } catch (achievementsError) {
        // Achievements table doesn't exist
      }

      const stats = {
        lessons_completed: lessonsResult.rows[0]?.count || 0,
        total_study_time: Math.round((timeResult.rows[0]?.total_attempts || 0) * (timeResult.rows[0]?.avg_time_per_attempt || 300)), // seconds
        achievements: achievementsCount
      };

      res.json({
        success: true,
        statistics: stats
      });
    } catch (error) {
      throw new Error('Không thể tải thống kê sử dụng');
    }
  });
}

module.exports = new SettingsController();