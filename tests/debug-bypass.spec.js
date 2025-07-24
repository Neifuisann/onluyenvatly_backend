import { test, expect } from '@playwright/test';

test('Debug Playwright bypass', async ({ page }) => {
  console.log('Navigating to lessons page...');
  
  // Go to lessons page
  const response = await page.goto('http://localhost:3000/lessons');
  
  console.log('Response status:', response?.status());
  console.log('Response URL:', page.url());
  
  // Take screenshot
  await page.screenshot({ path: 'debug-bypass.png', fullPage: true });
  
  // Check if we're on login page
  if (page.url().includes('/login')) {
    console.log('FAILED: Redirected to login page - bypass not working');
  } else if (page.url().includes('/lessons')) {
    console.log('SUCCESS: On lessons page - bypass is working');
  }
  
  // Log user agent
  const userAgent = await page.evaluate(() => navigator.userAgent);
  console.log('User agent:', userAgent);
  
  // Check for lesson cards
  const hasLessonCards = await page.locator('[data-testid="lesson-card"]').count();
  console.log('Lesson cards found:', hasLessonCards);
});