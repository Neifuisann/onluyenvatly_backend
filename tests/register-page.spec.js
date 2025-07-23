const { test, expect } = require('@playwright/test');

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/register');
  });

  test('should display multiple registration methods', async ({ page }) => {
    // Check for all registration method options
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /facebook/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /số điện thoại/i })).toBeVisible();
  });

  test('should show phone number registration form when phone method is clicked', async ({ page }) => {
    // Click on phone number registration method
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Check for phone number input field
    await expect(page.getByLabel(/số điện thoại/i)).toBeVisible();
    
    // Check for password input field
    await expect(page.getByLabel(/^mật khẩu$/i)).toBeVisible();
    
    // Check for repeat password input field
    await expect(page.getByLabel(/nhập lại mật khẩu|xác nhận mật khẩu/i)).toBeVisible();
    
    // Check for submit button
    await expect(page.getByRole('button', { name: /đăng ký/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /đăng ký/i })).toBeEnabled();
  });

  test('should display password strength indicator and validate password requirements', async ({ page }) => {
    // Click on phone number registration method
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Type in password field to trigger strength indicator
    const passwordInput = page.getByLabel(/^mật khẩu$/i);
    
    // Test weak password
    await passwordInput.fill('weak');
    await expect(page.locator('[data-testid="password-strength-bar"], .password-strength-bar, [class*="strength"]')).toBeVisible();
    
    // Test strong password with all requirements
    await passwordInput.clear();
    await passwordInput.fill('StrongPass123!');
    
    // Check for password requirements indicators
    await expect(page.getByText(/chữ hoa|uppercase/i)).toBeVisible();
    await expect(page.getByText(/chữ thường|lowercase/i)).toBeVisible();
    await expect(page.getByText(/số|number|digit/i)).toBeVisible();
    await expect(page.getByText(/ký tự đặc biệt|special character/i)).toBeVisible();
  });

  test('should display login suggestion for existing users', async ({ page }) => {
    // Check for login suggestion text
    await expect(page.getByText(/đã có tài khoản|already have an account/i)).toBeVisible();
    
    // Check for login link
    const loginLink = page.getByRole('link', { name: /đăng nhập/i });
    await expect(loginLink).toBeVisible();
    
    // Verify the link points to login page
    const href = await loginLink.getAttribute('href');
    expect(href).toContain('/login');
  });

  test('should successfully register and redirect to login page', async ({ page }) => {
    // Click on phone number registration method
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Fill in the registration form
    await page.getByLabel(/số điện thoại/i).fill('0123456789');
    await page.getByLabel(/^mật khẩu$/i).fill('StrongPass123!');
    await page.getByLabel(/nhập lại mật khẩu|xác nhận mật khẩu/i).fill('StrongPass123!');
    
    // Submit the form
    await page.getByRole('button', { name: /đăng ký/i }).click();
    
    // Wait for redirect to login page
    await page.waitForURL('**/login', { timeout: 5000 });
    
    // Verify we're on the login page
    expect(page.url()).toContain('/login');
  });

  test('should validate password match', async ({ page }) => {
    // Click on phone number registration method
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Fill in mismatched passwords
    await page.getByLabel(/số điện thoại/i).fill('0123456789');
    await page.getByLabel(/^mật khẩu$/i).fill('StrongPass123!');
    await page.getByLabel(/nhập lại mật khẩu|xác nhận mật khẩu/i).fill('DifferentPass123!');
    
    // Try to submit
    await page.getByRole('button', { name: /đăng ký/i }).click();
    
    // Check for error message
    await expect(page.getByText(/mật khẩu không khớp|passwords do not match/i)).toBeVisible();
  });
});