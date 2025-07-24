import { test, expect } from '@playwright/test';

test('Debug lessons page', async ({ page }) => {
  // Navigate to lessons page
  await page.goto('http://localhost:3000/lessons');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot
  await page.screenshot({ path: 'lessons-page-debug.png', fullPage: true });
  
  // Log page content
  const pageContent = await page.content();
  console.log('Page title:', await page.title());
  console.log('Page URL:', page.url());
  
  // Check if there's any error message
  const errorElement = await page.locator('[data-testid="error-message"]').isVisible();
  if (errorElement) {
    const errorText = await page.locator('[data-testid="error-message"]').textContent();
    console.log('Error found:', errorText);
  }
  
  // Check if loading skeleton is visible
  const loadingElement = await page.locator('[data-testid="loading-skeleton"]').isVisible();
  console.log('Loading skeleton visible:', loadingElement);
  
  // Wait a bit more and check for lesson cards
  await page.waitForTimeout(5000);
  const lessonCards = await page.locator('[data-testid="lesson-card"]').count();
  console.log('Number of lesson cards found:', lessonCards);
  
  // Check console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });
  
  // Check network errors
  page.on('response', response => {
    if (!response.ok() && response.url().includes('/api/')) {
      console.log(`API Error: ${response.status()} ${response.statusText()} - ${response.url()}`);
    }
  });
  
  // Wait for API call
  try {
    const apiResponse = await page.waitForResponse(
      resp => resp.url().includes('/api/lessons'),
      { timeout: 10000 }
    );
    console.log('API Response status:', apiResponse.status());
    console.log('API Response URL:', apiResponse.url());
    const responseData = await apiResponse.json();
    console.log('API Response data:', JSON.stringify(responseData, null, 2));
  } catch (error) {
    console.log('Failed to capture API response:', error.message);
  }
});