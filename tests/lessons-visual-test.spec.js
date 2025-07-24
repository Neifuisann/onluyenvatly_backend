import { test, expect } from '@playwright/test';

test('Visual test - Lessons page working correctly', async ({ page }) => {
  // Go to lessons page
  await page.goto('http://localhost:3000/lessons');
  
  // Wait for API response
  await page.waitForResponse(
    resp => resp.url().includes('/api/lessons') && resp.status() === 200,
    { timeout: 10000 }
  );
  
  // Wait for page to stabilize
  await page.waitForTimeout(2000);
  
  // Take screenshot
  await page.screenshot({ path: 'lessons-page-final.png', fullPage: true });
  
  // Check basic elements
  const hasLessonCards = await page.locator('[data-testid="lesson-card"]').count();
  console.log('Number of lesson cards:', hasLessonCards);
  
  const hasSearchInput = await page.locator('[data-testid="search-input"]').isVisible();
  console.log('Search input visible:', hasSearchInput);
  
  const hasSortSelect = await page.locator('[data-testid="sort-select"]').isVisible();
  console.log('Sort select visible:', hasSortSelect);
  
  // Basic assertions
  expect(hasLessonCards).toBeGreaterThan(0);
  expect(hasSearchInput).toBe(true);
  expect(hasSortSelect).toBe(true);
  
  console.log('✅ Lessons page is working correctly!');
});