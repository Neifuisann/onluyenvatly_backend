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
    
    // Check for full name input field
    await expect(page.getByLabel(/họ và tên|họ tên/i)).toBeVisible();
    
    // Check for phone number input field
    await expect(page.getByLabel(/số điện thoại/i)).toBeVisible();
    
    // Check for password input field - try with case insensitive and more flexible regex
    await expect(page.locator('label:has-text("mật khẩu")').first()).toBeVisible();
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible();
    
    // Check for repeat password input field
    const confirmPasswordInput = page.locator('input[type="password"]').nth(1);
    await expect(confirmPasswordInput).toBeVisible();
    
    // Check for submit button
    await expect(page.getByRole('button', { name: /đăng ký/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /đăng ký/i })).toBeEnabled();
  });

  test('should display password strength indicator and validate password requirements', async ({ page }) => {
    // Click on phone number registration method
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Fill in full name to focus on password testing
    await page.getByLabel(/họ và tên|họ tên/i).fill('Test User');
    
    // Type in password field to trigger strength indicator
    const passwordInput = page.locator('input[type="password"]').first();
    
    // Test weak password
    await passwordInput.fill('weak');
    await expect(page.locator('[data-testid="password-strength-bar"], .password-strength-bar, [class*="strength"]')).toBeVisible();
    
    // Test strong password with all requirements
    await passwordInput.clear();
    await passwordInput.fill('StrongPass123!');
    
    // Check for password requirements indicators - be more specific to avoid conflicts
    await expect(page.locator('.space-y-1').getByText(/chữ hoa|uppercase/i)).toBeVisible();
    await expect(page.locator('.space-y-1').getByText(/chữ thường|lowercase/i)).toBeVisible();
    await expect(page.locator('.space-y-1').getByText('Số')).toBeVisible();
    await expect(page.locator('.space-y-1').getByText(/ký tự đặc biệt|special character/i)).toBeVisible();
  });

  test('should display login suggestion for existing users', async ({ page }) => {
    // Check for login suggestion text
    await expect(page.getByText(/đã có tài khoản|already have an account/i)).toBeVisible();
    
    // Check for login link in the main content area (not in header)
    const loginLink = page.getByRole('main').getByRole('link', { name: /đăng nhập/i });
    await expect(loginLink).toBeVisible();
    
    // Verify the link points to login page
    const href = await loginLink.getAttribute('href');
    expect(href).toContain('/login');
  });

  test('should successfully register and redirect to login page', async ({ page }) => {
    // Click on phone number registration method
    await page.getByRole('button', { name: /số điện thoại/i }).click();
    
    // Fill in the registration form
    await page.getByLabel(/họ và tên|họ tên/i).fill('Nguyễn Văn A');
    await page.getByLabel(/số điện thoại/i).fill('0375931008');
    await page.locator('input[type="password"]').first().fill('StrongPass123!');
    await page.locator('input[type="password"]').nth(1).fill('StrongPass123!');
    
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
    await page.getByLabel(/họ và tên|họ tên/i).fill('Nguyễn Văn B');
    await page.getByLabel(/số điện thoại/i).fill('0375931009');
    await page.locator('input[type="password"]').first().fill('StrongPass123!');
    await page.locator('input[type="password"]').nth(1).fill('DifferentPass123!');
    
    // Try to submit
    await page.getByRole('button', { name: /đăng ký/i }).click();
    
    // Check for error message
    await expect(page.getByText(/mật khẩu không khớp|passwords do not match/i)).toBeVisible();
  });
});