const { test, expect } = require('@playwright/test');

test.describe('Logout Security Tests', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3001/login');
    
    // Click phone number method
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Fill in credentials
    await page.getByLabel(/số điện thoại/i).fill('0375931007');
    await page.getByLabel(/mật khẩu/i).fill('140207');
    
    // Click login button
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    
    // Wait for either redirect or avatar to appear (whichever comes first)
    await Promise.race([
      page.waitForURL('http://localhost:3001/', { timeout: 10000 }),
      page.locator('[data-testid="user-avatar"]').waitFor({ state: 'visible', timeout: 10000 })
    ]).catch(() => {
      // If login fails, we're still on login page
    });
    
    // Navigate to home page to ensure we're there
    if (page.url() !== 'http://localhost:3001/') {
      await page.goto('http://localhost:3001/');
    }
  });

  test.describe('Desktop Logout Security', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('should prevent access to protected routes after logout', async ({ page }) => {
      // First, verify we're logged in by checking avatar is visible
      const avatar = page.locator('[data-testid="user-avatar"]');
      await expect(avatar).toBeVisible();
      
      // Navigate to a protected route (like settings) to verify access
      await page.goto('http://localhost:3001/settings');
      await expect(page).toHaveURL(/\/settings/);
      
      // Go back to home page
      await page.goto('http://localhost:3001/');
      
      // Perform logout
      await avatar.hover();
      await page.getByRole('menuitem', { name: /đăng xuất|logout/i }).click();
      
      // Wait for redirect to home page and verify logout
      await page.waitForURL('http://localhost:3001/');
      await expect(page.getByRole('button', { name: /đăng nhập/i })).toBeVisible();
      
      // Now try to access the protected route again
      await page.goto('http://localhost:3001/settings');
      
      // Should be redirected to login page
      await expect(page).toHaveURL(/\/login/);
      
      // Verify we're on login page by checking for login form
      await expect(page.getByLabel(/số điện thoại/i)).toBeVisible();
    });

    test('should clear all authentication state after logout', async ({ page }) => {
      // Verify we're logged in
      const avatar = page.locator('[data-testid="user-avatar"]');
      await expect(avatar).toBeVisible();
      
      // Check that localStorage has auth data before logout
      const authDataBefore = await page.evaluate(() => {
        return localStorage.getItem('auth-storage');
      });
      expect(authDataBefore).toBeTruthy();
      
      // Perform logout
      await avatar.hover();
      await page.getByRole('menuitem', { name: /đăng xuất|logout/i }).click();
      
      // Wait for redirect
      await page.waitForURL('http://localhost:3001/');
      
      // Check that localStorage auth data is cleared
      const authDataAfter = await page.evaluate(() => {
        return localStorage.getItem('auth-storage');
      });
      expect(authDataAfter).toBeFalsy();
      
      // Check that session cookie is cleared
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(cookie => cookie.name === 'connect.sid');
      expect(sessionCookie).toBeFalsy();
    });

    test('should handle logout even if backend call fails', async ({ page }) => {
      // Verify we're logged in
      const avatar = page.locator('[data-testid="user-avatar"]');
      await expect(avatar).toBeVisible();
      
      // Intercept logout API call and make it fail
      await page.route('**/api/auth/logout', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        });
      });
      
      // Perform logout
      await avatar.hover();
      await page.getByRole('menuitem', { name: /đăng xuất|logout/i }).click();
      
      // Should still redirect to home page and clear local state
      await page.waitForURL('http://localhost:3001/');
      await expect(page.getByRole('button', { name: /đăng nhập/i })).toBeVisible();
      
      // Local storage should still be cleared
      const authDataAfter = await page.evaluate(() => {
        return localStorage.getItem('auth-storage');
      });
      expect(authDataAfter).toBeFalsy();
    });
  });

  test.describe('Mobile Logout Security', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should prevent access to protected routes after mobile logout', async ({ page }) => {
      // Verify we're logged in by checking mobile menu is available
      const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
      await expect(mobileMenuButton).toBeVisible();
      
      // Navigate to a protected route
      await page.goto('http://localhost:3001/settings');
      await expect(page).toHaveURL(/\/settings/);
      
      // Go back to home page
      await page.goto('http://localhost:3001/');
      
      // Perform logout via mobile menu
      await mobileMenuButton.click();
      await page.getByRole('menuitem', { name: /đăng xuất|logout/i }).click();
      
      // Wait for redirect and verify logout
      await page.waitForURL('http://localhost:3001/');
      await expect(mobileMenuButton).not.toBeVisible();
      
      // Try to access protected route
      await page.goto('http://localhost:3001/settings');
      
      // Should be redirected to login page
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
