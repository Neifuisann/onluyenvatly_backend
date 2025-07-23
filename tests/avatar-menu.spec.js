const { test, expect } = require('@playwright/test');

test.describe('Avatar Menu', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/login');
    
    // Click phone number method
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Fill in credentials
    await page.getByLabel(/số điện thoại/i).fill('0375931007');
    await page.getByLabel(/mật khẩu/i).fill('140207');
    
    // Click login button
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    
    // Wait for either redirect or avatar to appear (whichever comes first)
    await Promise.race([
      page.waitForURL('http://localhost:3000/', { timeout: 10000 }),
      page.locator('[data-testid="user-avatar"]').waitFor({ state: 'visible', timeout: 10000 })
    ]).catch(() => {
      // If login fails, we're still on login page
    });
    
    // Navigate to home page to ensure we're there
    if (page.url() !== 'http://localhost:3000/') {
      await page.goto('http://localhost:3000/');
    }
  });

  test.describe('Desktop', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('should display avatar instead of sign in button after login', async ({ page }) => {
      // Check that sign in button is not visible
      await expect(page.getByRole('button', { name: /đăng nhập/i })).not.toBeVisible();
      
      // Check that avatar is visible
      const avatar = page.locator('[data-testid="user-avatar"]');
      await expect(avatar).toBeVisible();
    });

    test('should show menu on avatar hover', async ({ page }) => {
      // Hover over avatar
      const avatar = page.locator('[data-testid="user-avatar"]');
      await avatar.hover();
      
      // Check menu items are visible
      await expect(page.getByRole('menuitem', { name: /cài đặt|settings/i })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /trợ giúp|help/i })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /đăng xuất|logout/i })).toBeVisible();
    });

    test('should logout when clicking logout menu item', async ({ page }) => {
      // Hover over avatar
      const avatar = page.locator('[data-testid="user-avatar"]');
      await avatar.hover();
      
      // Click logout
      await page.getByRole('menuitem', { name: /đăng xuất|logout/i }).click();
      
      // Should redirect to landing page and show sign in button
      await page.waitForURL('http://localhost:3000/');
      await expect(page.getByRole('button', { name: /đăng nhập/i })).toBeVisible();
    });

    test('should navigate to settings when clicking settings menu item', async ({ page }) => {
      // Hover over avatar
      const avatar = page.locator('[data-testid="user-avatar"]');
      await avatar.hover();
      
      // Click settings
      await page.getByRole('menuitem', { name: /cài đặt|settings/i }).click();
      
      // Should navigate to settings page
      await expect(page).toHaveURL(/\/settings/);
    });

    test('should navigate to help when clicking help menu item', async ({ page }) => {
      // Hover over avatar
      const avatar = page.locator('[data-testid="user-avatar"]');
      await avatar.hover();
      
      // Click help
      await page.getByRole('menuitem', { name: /trợ giúp|help/i }).click();
      
      // Should navigate to help page
      await expect(page).toHaveURL(/\/help/);
    });
  });

  test.describe('Mobile', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should hide sign in button and show mobile menu after login', async ({ page }) => {
      // Check that sign in button is not visible
      await expect(page.getByRole('button', { name: /đăng nhập/i })).not.toBeVisible();
      
      // Check that mobile menu button is visible
      const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
      await expect(mobileMenuButton).toBeVisible();
    });

    test('should show menu items when clicking mobile menu', async ({ page }) => {
      // Click mobile menu button
      const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
      await mobileMenuButton.click();
      
      // Check menu items are visible
      await expect(page.getByRole('menuitem', { name: /cài đặt|settings/i })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /trợ giúp|help/i })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /đăng xuất|logout/i })).toBeVisible();
    });

    test('should logout when clicking logout in mobile menu', async ({ page }) => {
      // Click mobile menu button
      const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
      await mobileMenuButton.click();
      
      // Click logout
      await page.getByRole('menuitem', { name: /đăng xuất|logout/i }).click();
      
      // Should redirect to landing page
      await page.waitForURL('http://localhost:3000/');
      
      // Mobile menu should not be visible anymore
      await expect(mobileMenuButton).not.toBeVisible();
    });
  });
});