const { test, expect } = require('@playwright/test');

test.describe('Avatar Menu - Simple Tests', () => {
  test('should show avatar when user data exists in localStorage', async ({ page }) => {
    // Set auth data in localStorage before navigating
    await page.addInitScript(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id: 'test-user',
            full_name: 'Test User',
            phone_number: '0375931007',
            role: 'student',
            isLoggedIn: true
          }
        },
        version: 0
      }));
    });

    // Navigate to home page
    await page.goto('http://localhost:3000/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check that sign in button is not visible
    const signInButton = page.getByRole('button', { name: /đăng nhập/i });
    await expect(signInButton).not.toBeVisible();
    
    // Check that avatar is visible
    const avatar = page.locator('[data-testid="user-avatar"]');
    await expect(avatar).toBeVisible();
  });

  test('should show menu on avatar hover', async ({ page }) => {
    // Set auth data in localStorage
    await page.addInitScript(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id: 'test-user',
            full_name: 'Test User',
            phone_number: '0375931007',
            role: 'student',
            isLoggedIn: true
          }
        },
        version: 0
      }));
    });

    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
    
    // Hover over avatar
    const avatar = page.locator('[data-testid="user-avatar"]');
    await avatar.hover();
    
    // Check menu items are visible
    await expect(page.getByRole('menuitem', { name: /cài đặt|settings/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /trợ giúp|help/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /đăng xuất|logout/i })).toBeVisible();
  });

  test('mobile menu should show user menu when logged in', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Set auth data
    await page.addInitScript(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id: 'test-user',
            full_name: 'Test User',
            phone_number: '0375931007',
            role: 'student',
            isLoggedIn: true
          }
        },
        version: 0
      }));
    });

    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
    
    // Click mobile menu button
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    await mobileMenuButton.click();
    
    // Check that user info is visible
    await expect(page.getByText('Test User')).toBeVisible();
    
    // Check menu items are visible
    await expect(page.getByRole('menuitem', { name: /cài đặt|settings/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /trợ giúp|help/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /đăng xuất|logout/i })).toBeVisible();
  });
});