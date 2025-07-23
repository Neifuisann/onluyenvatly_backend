const { supabase } = require('../config/database');
const logger = require('../utils/logger');

// Cache the encryption status to avoid frequent database queries
let encryptionEnabledCache = {
  value: true, // Default to enabled
  timestamp: 0,
  ttl: 60000 // Cache TTL in milliseconds (1 minute)
};

// Bypass paths that should work even when encryption is disabled
const ENCRYPTION_BYPASS_PATHS = [
  '/api/auth',
  '/api/admin',
  '/api/health',
  '/api/results' // Added bypass for results API
];

/**
 * Check if encryption is enabled in the system
 * @returns {Promise<boolean>} True if encryption is enabled, false otherwise
 */
const isEncryptionEnabled = async () => {
  const now = Date.now();
  
  // Return cached value if still valid
  if (now - encryptionEnabledCache.timestamp < encryptionEnabledCache.ttl) {
    return encryptionEnabledCache.value;
  }
  
  try {
    // Get encryption status from database
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'encryption_enabled')
      .single();

    if (error) {
      logger.error('Error getting encryption status:', error);
      // Default to enabled if there's an error
      return true;
    }

    // Default to enabled if setting doesn't exist
    const encryptionEnabled = !data ? true : data.value === 'true';
    
    // Update cache
    encryptionEnabledCache = {
      value: encryptionEnabled,
      timestamp: now,
      ttl: 60000
    };
    
    return encryptionEnabled;
  } catch (error) {
    logger.error('Error checking encryption status:', error);
    // Default to enabled if there's an error
    return true;
  }
};

/**
 * Check if a path should bypass encryption checks
 * @param {string} path - Request path
 * @returns {boolean} True if path should bypass encryption
 */
const shouldBypassEncryption = (path) => {
  return ENCRYPTION_BYPASS_PATHS.some(bypassPath => path.startsWith(bypassPath));
};

/**
 * Clear the encryption status cache
 * Used when the status is updated
 */
const clearEncryptionCache = () => {
  encryptionEnabledCache.timestamp = 0;
};

module.exports = {
  isEncryptionEnabled,
  shouldBypassEncryption,
  clearEncryptionCache,
  ENCRYPTION_BYPASS_PATHS
};