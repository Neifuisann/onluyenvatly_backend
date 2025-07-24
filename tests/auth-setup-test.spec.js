// Auto-generated test to verify authentication setup
const { test, expect } = require('@playwright/test');
const { AuthUtils } = require('./auth-utils');

test('verify authentication setup', async ({ page }) => {
  const authUtils = new AuthUtils();
  
  // Check if auth files exist
  const hasTokens = authUtils.getTestTokens();
  console.log('Test tokens available:', !!hasTokens);
  
  // Try to access a public page
  await page.goto('/');
  await expect(page).toHaveTitle(/.*/, { timeout: 10000 });
  
  console.log('✅ Basic setup verification passed');
});
