const databaseService = require('../services/databaseService');
const { asyncHandler } = require('../middleware/errorHandler');

class AdminController {
    // Get all students
    getStudents = asyncHandler(async (req, res) => {
        const { approved } = req.query;
        const approvedFilter = approved === 'true' ? true : approved === 'false' ? false : null;

        const students = await databaseService.getStudents({ approved: approvedFilter });
        res.json(students);
    });

    // Get unapproved students
    getUnapprovedStudents = asyncHandler(async (req, res) => {
        const students = await databaseService.getStudents({ approved: false });
        res.json(students);
    });

    // Get approved students
    getApprovedStudents = asyncHandler(async (req, res) => {
        const students = await databaseService.getStudents({ approved: true });
        res.json(students);
    });
    
    // Approve student
    approveStudent = asyncHandler(async (req, res) => {
        const { studentId } = req.params;
        const { deviceId } = req.body;
        
        const updateData = { is_approved: true };
        if (deviceId) {
            updateData.approved_device_id = deviceId;
            updateData.device_registered_at = new Date().toISOString();
        }
        
        await databaseService.updateStudent(studentId, updateData);
        
        res.json({ 
            success: true, 
            message: 'Student approved successfully' 
        });
    });
    
    // Reject student
    rejectStudent = asyncHandler(async (req, res) => {
        const { studentId } = req.params;
        
        await databaseService.updateStudent(studentId, { is_approved: false });
        
        res.json({ 
            success: true, 
            message: 'Student rejected successfully' 
        });
    });
    
    // Delete student and all data
    deleteStudent = asyncHandler(async (req, res) => {
        const { studentId } = req.params;
        
        await databaseService.deleteStudentAndData(studentId);
        
        res.json({ 
            success: true, 
            message: 'Student and all associated data deleted successfully' 
        });
    });
    
    // Update device info
    updateDeviceInfo = asyncHandler(async (req, res) => {
        const { studentId } = req.params;
        const { deviceId, deviceFingerprint } = req.body;
        
        await databaseService.updateDeviceInfo(studentId, deviceId, deviceFingerprint);
        
        res.json({ 
            success: true, 
            message: 'Device information updated successfully' 
        });
    });
    
    // Unbind device
    unbindDevice = asyncHandler(async (req, res) => {
        const { studentId } = req.params;
        
        await databaseService.unbindDevice(studentId);
        
        res.json({ 
            success: true, 
            message: 'Device unbound successfully' 
        });
    });
    
    // Get student profile
    getStudentProfile = asyncHandler(async (req, res) => {
        const { studentId } = req.params;
        
        const profile = await databaseService.getStudentProfile(studentId);
        res.json(profile);
    });

    // Get dashboard statistics
    getDashboardStats = asyncHandler(async (req, res) => {
        try {
            const stats = await databaseService.calculatePlatformStats();
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            res.status(500).json({
                success: false,
                message: 'Error calculating dashboard statistics'
            });
        }
    });
}

module.exports = new AdminController();
