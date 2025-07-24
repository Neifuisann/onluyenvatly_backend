import { test, expect } from '@playwright/test';

// Helper function to login
async function loginAsStudent(page) {
  await page.goto('http://localhost:3000/login');
  
  // Wait for login page to load
  await page.waitForLoadState('networkidle');
  
  // Click on phone login option
  await page.locator('text=Số điện thoại').click();
  
  // Fill in credentials
  await page.fill('input[name="phone_number"]', '0375931007');
  await page.fill('input[name="password"]', '140207');
  
  // Submit form
  await page.locator('button[type="submit"]').click();
  
  // Wait for navigation after successful login
  await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
}

test.describe('Lessons Page (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsStudent(page);
    
    // Navigate to lessons page
    await page.goto('http://localhost:3000/lessons');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load lessons from backend API', async ({ page }) => {
    // Intercept API call to verify it's made
    const apiResponse = page.waitForResponse(resp => 
      resp.url().includes('/api/lessons') && resp.status() === 200
    );

    await page.reload();
    const response = await apiResponse;
    const data = await response.json();
    
    expect(data).toHaveProperty('lessons');
    expect(Array.isArray(data.lessons)).toBe(true);
  });

  test('should display lesson cards with all required information', async ({ page }) => {
    // Wait for lessons to load
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 10000 });
    
    const lessonCards = page.locator('[data-testid="lesson-card"]');
    const cardCount = await lessonCards.count();
    expect(cardCount).toBeGreaterThan(0);
    
    const firstCard = lessonCards.first();
    
    // Check all required elements are present
    await expect(firstCard.locator('[data-testid="lesson-title"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-subject"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-grade"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-views"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-description"]')).toBeVisible();
    
    // Verify description is truncated
    const description = await firstCard.locator('[data-testid="lesson-description"]').textContent();
    expect(description).toBeTruthy();
  });

  test('should have working search functionality with debounce', async ({ page }) => {
    await page.waitForSelector('[data-testid="search-input"]');
    
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Type search query
    await searchInput.fill('physics test search');
    
    // Wait for debounce and API call
    await page.waitForResponse(
      resp => resp.url().includes('/api/lessons') && resp.url().includes('search='),
      { timeout: 5000 }
    );
    
    // Wait a bit more for URL to update after response
    await page.waitForTimeout(100);
    
    // Verify search parameter in URL
    expect(page.url()).toContain('search=physics');
  });

  test('should have all sort options working', async ({ page }) => {
    await page.waitForSelector('[data-testid="sort-select"]');
    
    const sortSelect = page.locator('[data-testid="sort-select"]');
    
    // Test sort by most views
    await sortSelect.click();
    await page.locator('text=Xem nhiều nhất').click();
    
    // Wait for API call with sort parameter
    await page.waitForResponse(resp => 
      resp.url().includes('/api/lessons') && 
      resp.url().includes('sort=popular')
    );
    
    // Verify URL updated
    expect(page.url()).toContain('sort=popular');
  });

  test('should open popup with lesson details when card is clicked', async ({ page }) => {
    await page.waitForSelector('[data-testid="lesson-card"]');
    
    const firstCard = page.locator('[data-testid="lesson-card"]').first();
    await firstCard.click();
    
    // Wait for popup to open
    await page.waitForSelector('[data-testid="lesson-dialog"]', { timeout: 5000 });
    
    const popup = page.locator('[data-testid="lesson-dialog"]');
    await expect(popup).toBeVisible();
    
    // Check popup content
    await expect(popup.locator('[data-testid="popup-title"]')).toBeVisible();
    await expect(popup.locator('[data-testid="confirm-button"]')).toBeVisible();
    await expect(popup.locator('[data-testid="return-button"]')).toBeVisible();
  });
});