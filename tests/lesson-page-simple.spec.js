import { test, expect } from '@playwright/test';

test.describe('Lesson Page Basic Tests', () => {
  test('should show error when no lesson ID is provided', async ({ page }) => {
    // Navigate to lesson page without ID
    await page.goto('http://localhost:3000/lesson');
    
    // Should show error message
    await expect(page.locator('text=No lesson ID provided')).toBeVisible();
    
    // Should have back to lessons button
    await expect(page.locator('text=Back to Lessons')).toBeVisible();
  });

  test('should have proper page structure', async ({ page }) => {
    // Navigate to lesson page with fake ID (will fail to load but page structure should exist)
    await page.goto('http://localhost:3000/lesson?id=test123');
    
    // Should show loading skeleton initially
    const skeleton = page.locator('.skeleton');
    
    // Wait for loading to complete (will show error)
    await page.waitForTimeout(1000);
    
    // Should have container structure
    await expect(page.locator('.container')).toBeVisible();
  });

  test('should navigate back to lessons page when back button is clicked', async ({ page }) => {
    await page.goto('http://localhost:3000/lesson');
    
    // Click back to lessons button
    await page.click('text=Back to Lessons');
    
    // Should navigate to lessons page
    await expect(page).toHaveURL('http://localhost:3000/lessons');
  });
});