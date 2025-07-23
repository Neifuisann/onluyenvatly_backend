import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should have "Bắt đầu học" button that redirects to /lessons', async ({ page }) => {
    // Check if the button exists
    const startButton = page.getByRole('button', { name: /Bắt đầu học/i });
    await expect(startButton).toBeVisible();
    
    // Click the button and verify navigation
    await startButton.click();
    await expect(page).toHaveURL('http://localhost:3000/lessons');
  });

  test('should have navbar with correct navigation links', async ({ page }) => {
    // Check navbar exists
    const navbar = page.getByRole('navigation');
    await expect(navbar).toBeVisible();
    
    // Test Home link
    const homeLink = navbar.getByRole('link', { name: /Trang chủ|Home/i });
    await expect(homeLink).toBeVisible();
    await homeLink.click();
    await expect(page).toHaveURL('http://localhost:3000/');
    
    // Test Lessons link
    const lessonsLink = navbar.getByRole('link', { name: /Bài học|Lessons/i });
    await expect(lessonsLink).toBeVisible();
    await lessonsLink.click();
    await expect(page).toHaveURL('http://localhost:3000/lessons');
    
    // Go back to home for next test
    await page.goto('http://localhost:3000');
    
    // Test Study Materials link
    const materialsLink = navbar.getByRole('link', { name: /Tài liệu|Study Materials/i });
    await expect(materialsLink).toBeVisible();
    await materialsLink.click();
    await expect(page).toHaveURL('http://localhost:3000/study-materials');
    
    // Go back to home for next test
    await page.goto('http://localhost:3000');
    
    // Test Leaderboard link
    const leaderboardLink = navbar.getByRole('link', { name: /Bảng xếp hạng|Leaderboard/i });
    await expect(leaderboardLink).toBeVisible();
    await leaderboardLink.click();
    await expect(page).toHaveURL('http://localhost:3000/leaderboard');
  });

  test('should have login/sign in button in navbar that redirects to /student/login', async ({ page }) => {
    // Check navbar exists
    const navbar = page.getByRole('navigation');
    await expect(navbar).toBeVisible();
    
    // Look for login button/link in the right side of navbar
    const loginButton = navbar.getByRole('link', { name: /Đăng nhập|Login|Sign in/i })
      .or(navbar.getByRole('button', { name: /Đăng nhập|Login|Sign in/i }));
    
    await expect(loginButton).toBeVisible();
    
    // Verify it's on the right side (this checks if it's within a container that has right alignment)
    const buttonParent = await loginButton.locator('..');
    const classes = await buttonParent.getAttribute('class');
    expect(classes).toMatch(/ml-auto|justify-end|right/);
    
    // Click and verify navigation
    await loginButton.click();
    await expect(page).toHaveURL('http://localhost:3000/student/login');
  });

  test('should use Material Design colors with light theme', async ({ page }) => {
    // Check for Material Design color classes or CSS variables
    const body = page.locator('body');
    const backgroundColor = await body.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Light theme should have light background
    expect(backgroundColor).toMatch(/rgb\(255,\s*255,\s*255\)|rgb\(250,\s*250,\s*250\)|rgb\(245,\s*245,\s*245\)/);
  });

  test('should use shadcn/ui components', async ({ page }) => {
    // Check for shadcn/ui specific classes
    const buttons = page.locator('button');
    const buttonsCount = await buttons.count();
    
    if (buttonsCount > 0) {
      const firstButton = buttons.first();
      const classes = await firstButton.getAttribute('class');
      // shadcn/ui buttons typically have these classes
      expect(classes).toMatch(/inline-flex|items-center|justify-center|rounded|font-medium/);
    }
  });

  test('should have proper motion animations', async ({ page }) => {
    // Check if motion/framer-motion is being used
    const animatedElements = page.locator('[data-framer-motion], [style*="transform"], [style*="opacity"]');
    const count = await animatedElements.count();
    
    // There should be at least some animated elements
    expect(count).toBeGreaterThan(0);
  });
});