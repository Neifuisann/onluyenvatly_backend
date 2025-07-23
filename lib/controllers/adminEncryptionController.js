const { supabase } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

class AdminEncryptionController {
  /**
   * Get public encryption system status (no auth required)
   * @route GET /api/admin/encryption/public-status
   */
  getPublicEncryptionStatus = asyncHandler(async (req, res) => {
    try {
      // Get encryption status from database
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'encryption_enabled')
        .single();

      if (error) {
        console.error('Error getting encryption status:', error);
        // Default to enabled if there's an error
        return res.json({
          success: true,
          encryptionEnabled: true
        });
      }

      // Default to enabled if setting doesn't exist
      const encryptionEnabled = !data ? true : data.value === 'true';

      res.json({
        success: true,
        encryptionEnabled
      });
    } catch (error) {
      console.error('Error getting public encryption status:', error);
      // Default to enabled if there's an error
      res.json({
        success: true,
        encryptionEnabled: true
      });
    }
  });

  /**
   * Get encryption system status
   * @route GET /api/admin/encryption/status
   */
  getEncryptionStatus = asyncHandler(async (req, res) => {
    try {
      // Get encryption status from database
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'encryption_enabled')
        .single();

      if (error) {
        console.error('Error getting encryption status:', error);
        // Default to enabled if there's an error
        return res.json({
          success: true,
          encryptionEnabled: true
        });
      }

      // Default to enabled if setting doesn't exist
      const encryptionEnabled = !data ? true : data.value === 'true';

      res.json({
        success: true,
        encryptionEnabled
      });
    } catch (error) {
      console.error('Error getting encryption status:', error);
      // Default to enabled if there's an error
      res.json({
        success: true,
        encryptionEnabled: true
      });
    }
  });

  /**
   * Toggle encryption system on/off
   * @route POST /api/admin/encryption/toggle
   */
  toggleEncryption = asyncHandler(async (req, res) => {
    try {
      // Get current encryption status
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'encryption_enabled')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting encryption status:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to get current encryption status'
        });
      }

      // Default to enabled if setting doesn't exist
      const currentStatus = !data ? true : data.value === 'true';
      const newStatus = !currentStatus;

      // Update or insert the setting using upsert
      const { error: upsertError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'encryption_enabled',
          value: newStatus.toString(),
          updated_at: new Date().toISOString()
        });

      if (upsertError) {
        console.error('Error updating encryption status:', upsertError);
        return res.status(500).json({
          success: false,
          message: 'Failed to update encryption status'
        });
      }

      // Clear the encryption cache to ensure changes take effect immediately
      const { clearEncryptionCache } = require('../middleware/encryptionToggle');
      clearEncryptionCache();

      // Log the change
      console.log(`🔒 Encryption system ${newStatus ? 'enabled' : 'disabled'} by admin`);

      res.json({
        success: true,
        message: `Encryption system ${newStatus ? 'enabled' : 'disabled'} successfully`,
        encryptionEnabled: newStatus
      });
    } catch (error) {
      console.error('Error toggling encryption:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle encryption system'
      });
    }
  });
}

module.exports = new AdminEncryptionController();