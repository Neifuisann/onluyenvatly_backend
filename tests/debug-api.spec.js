import { test, expect } from '@playwright/test';

test('Debug API and lessons loading', async ({ page }) => {
  // Set up response listener before navigation
  let apiCalled = false;
  let apiResponse = null;
  
  page.on('response', async (response) => {
    if (response.url().includes('/api/lessons')) {
      apiCalled = true;
      console.log('API Call detected:', response.url());
      console.log('API Status:', response.status());
      
      try {
        const data = await response.json();
        apiResponse = data;
        console.log('API Response:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('Failed to parse API response:', e.message);
      }
    }
  });
  
  // Navigate to lessons page
  await page.goto('http://localhost:3000/lessons');
  
  // Wait a bit for API calls
  await page.waitForTimeout(3000);
  
  console.log('API was called:', apiCalled);
  
  // Check console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser console error:', msg.text());
    }
  });
  
  // Check loading state
  const loadingVisible = await page.locator('[data-testid="loading-skeleton"]').isVisible();
  console.log('Loading skeleton visible:', loadingVisible);
  
  // Check error state
  const errorVisible = await page.locator('[data-testid="error-message"]').isVisible();
  if (errorVisible) {
    const errorText = await page.locator('[data-testid="error-message"]').textContent();
    console.log('Error message:', errorText);
  }
  
  // Check lesson cards
  const lessonCards = await page.locator('[data-testid="lesson-card"]').count();
  console.log('Lesson cards count:', lessonCards);
  
  // Take screenshot
  await page.screenshot({ path: 'debug-api-lessons.png', fullPage: true });
  
  // If API wasn't called, try to trigger it
  if (!apiCalled) {
    console.log('API was not called automatically, trying to trigger...');
    
    // Check if page has any JavaScript errors
    const pageContent = await page.content();
    if (pageContent.includes('_next')) {
      console.log('Next.js loaded successfully');
    }
  }
  
  // Check network state
  const hasNetworkError = await page.evaluate(() => {
    return !navigator.onLine;
  });
  console.log('Network offline:', hasNetworkError);
});