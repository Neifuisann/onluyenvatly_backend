import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should have "Bắt đầu học" button that redirects to /lessons', async ({ page }) => {
    // Check if the link exists (Button component renders as a link)
    const startButton = page.getByRole('link', { name: /Bắt đầu học/i });
    await expect(startButton).toBeVisible();
    
    // Click the button and verify navigation
    await startButton.click();
    await expect(page).toHaveURL('http://localhost:3000/lessons');
  });

  test('should have navbar with correct navigation links', async ({ page }) => {
    // Check navbar exists
    const navbar = page.getByRole('navigation');
    await expect(navbar).toBeVisible();
    
    // Check if mobile or desktop
    const isMobile = page.viewportSize()?.width < 768;
    
    if (isMobile) {
      // Mobile test - check hamburger menu
      const menuButton = navbar.getByRole('button', { name: /menu/i });
      await expect(menuButton).toBeVisible();
      
      // Open mobile menu
      await menuButton.click();
      
      // Wait for menu to open
      await page.waitForTimeout(300);
      
      // Check all navigation items in mobile menu
      const mobileMenu = page.getByRole('dialog');
      await expect(mobileMenu).toBeVisible();
      
      // Test navigation links in mobile menu
      const homeLink = mobileMenu.getByRole('link', { name: /Trang chủ/i });
      await expect(homeLink).toBeVisible();
      
      const lessonsLink = mobileMenu.getByRole('link', { name: /Bài học/i });
      await expect(lessonsLink).toBeVisible();
      
      const materialsLink = mobileMenu.getByRole('link', { name: /Tài liệu/i });
      await expect(materialsLink).toBeVisible();
      
      const leaderboardLink = mobileMenu.getByRole('link', { name: /Bảng xếp hạng/i });
      await expect(leaderboardLink).toBeVisible();
      
      // Check login button in mobile menu
      const loginButton = mobileMenu.getByRole('link', { name: /Đăng nhập/i });
      await expect(loginButton).toBeVisible();
      
      // Test navigation
      await lessonsLink.click();
      await expect(page).toHaveURL('http://localhost:3000/lessons');
      
      return; // Skip desktop tests for mobile
    }
    
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
    // Wait a bit for navigation
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL('http://localhost:3000/leaderboard');
  });

  test('should have login/sign in button in navbar that redirects to /student/login', async ({ page }) => {
    // Check navbar exists
    const navbar = page.getByRole('navigation');
    await expect(navbar).toBeVisible();
    
    // Check if mobile or desktop
    const isMobile = page.viewportSize()?.width < 768;
    
    if (isMobile) {
      // On mobile, login button is in the hamburger menu
      const menuButton = navbar.getByRole('button', { name: /menu/i });
      await menuButton.click();
      await page.waitForTimeout(300);
      
      const mobileMenu = page.getByRole('dialog');
      const loginButton = mobileMenu.getByRole('link', { name: /Đăng nhập|Login|Sign in/i });
      await expect(loginButton).toBeVisible();
      
      await loginButton.click();
      await expect(page).toHaveURL('http://localhost:3000/student/login');
    } else {
      // On desktop, login button is visible in navbar
      const loginButton = navbar.getByRole('link', { name: /Đăng nhập|Login|Sign in/i });
      await expect(loginButton).toBeVisible();
      
      await loginButton.click();
      await expect(page).toHaveURL('http://localhost:3000/student/login');
    }
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

  test('should have working mobile hamburger menu', async ({ page }) => {
    // Only run this test on mobile viewport
    const isMobile = page.viewportSize()?.width < 768;
    if (!isMobile) {
      test.skip();
      return;
    }

    // Check hamburger menu button exists
    const menuButton = page.getByRole('button', { name: /menu/i });
    await expect(menuButton).toBeVisible();
    
    // Desktop navigation should be hidden
    const desktopNav = page.locator('.hidden.md\\:flex');
    await expect(desktopNav).not.toBeVisible();
    
    // Open menu
    await menuButton.click();
    await page.waitForTimeout(300);
    
    // Check mobile menu is visible
    const mobileMenu = page.getByRole('dialog');
    await expect(mobileMenu).toBeVisible();
    
    // Close menu by clicking a link
    const lessonsLink = mobileMenu.getByRole('link', { name: /Bài học/i });
    await lessonsLink.click();
    
    // Menu should close after navigation
    await page.waitForTimeout(500);
    await expect(mobileMenu).not.toBeVisible();
  });
});