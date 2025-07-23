const { test, expect } = require('@playwright/test');

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
  });

  test('should display multiple sign-in methods', async ({ page }) => {
    // Check for multiple sign-in method buttons
    await expect(page.getByRole('button', { name: /đăng nhập với google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /đăng nhập với facebook/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /số điện thoại/i })).toBeVisible();
  });

  test('should handle multi-stage phone number login', async ({ page }) => {
    // Click on phone number method
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Check for phone number and password input fields
    await expect(page.getByLabel(/số điện thoại/i)).toBeVisible();
    await expect(page.getByLabel(/mật khẩu/i)).toBeVisible();
    
    // Check for submit button
    await expect(page.getByRole('button', { name: /đăng nhập/i })).toBeVisible();
  });

  test('should display sign up suggestion for new users', async ({ page }) => {
    // Check for sign up link at the bottom
    await expect(page.getByText(/chưa có tài khoản.*đăng ký/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /đăng ký/i })).toBeVisible();
  });

  test('should display forgot password link', async ({ page }) => {
    // Click on phone number method first
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Check for forgot password link
    await expect(page.getByRole('link', { name: /quên mật khẩu/i })).toBeVisible();
  });

  test('should login with phone number and redirect correctly', async ({ page }) => {
    // Test credentials from CLAUDE.md
    const phoneNumber = '0375931007';
    const password = '140207';
    
    // Click phone number method
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Fill in credentials
    await page.getByLabel(/số điện thoại/i).fill(phoneNumber);
    await page.getByLabel(/mật khẩu/i).fill(password);
    
    // Click login button and wait for navigation
    await Promise.all([
      page.waitForURL('http://localhost:3000/', { timeout: 10000 }),
      page.getByRole('button', { name: /đăng nhập/i }).click()
    ]);
  });

  test('should redirect to intended page after login', async ({ page }) => {
    // Navigate to a protected page first
    await page.goto('http://localhost:3000/lessons');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
    
    // Login with test credentials
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    await page.getByLabel(/số điện thoại/i).fill('0375931007');
    await page.getByLabel(/mật khẩu/i).fill('140207');
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    
    // Should redirect back to lessons page
    await page.waitForURL('http://localhost:3000/lessons', { timeout: 10000 });
  });

  test('should have proper styling and UX', async ({ page }) => {
    // Check for clean, modern design elements
    const loginContainer = page.locator('[data-testid="login-container"]');
    await expect(loginContainer).toBeVisible();
    
    // Check for smooth animations when switching methods
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Form should animate in smoothly
    const loginForm = page.locator('form');
    await expect(loginForm).toBeVisible();
  });
});