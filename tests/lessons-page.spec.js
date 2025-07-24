import { test, expect } from '@playwright/test';

test.describe('Lessons Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/lessons');
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
    expect(data.lessons.length).toBeGreaterThan(0);
  });

  test('should display lesson cards with all required information', async ({ page }) => {
    // Wait for lessons to load
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 10000 });
    
    const lessonCards = page.locator('[data-testid="lesson-card"]');
    const firstCard = lessonCards.first();
    
    // Check all required elements are present
    await expect(firstCard.locator('[data-testid="lesson-title"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-subject"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-grade"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-views"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-description"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-thumbnail"]')).toBeVisible();
    
    // Verify description is truncated
    const description = await firstCard.locator('[data-testid="lesson-description"]').textContent();
    expect(description).toBeTruthy();
    expect(description.length).toBeLessThanOrEqual(150); // Assuming truncation at 150 chars
  });

  test('should display base64 thumbnails correctly', async ({ page }) => {
    await page.waitForSelector('[data-testid="lesson-thumbnail"]');
    
    const thumbnail = page.locator('[data-testid="lesson-thumbnail"]').first();
    const src = await thumbnail.getAttribute('src');
    
    // Check if it's a base64 image
    expect(src).toMatch(/^data:image\/(png|jpg|jpeg|gif|webp);base64,/);
    
    // Verify image is loaded
    const isLoaded = await thumbnail.evaluate((img) => {
      return img.complete && img.naturalHeight > 0;
    });
    expect(isLoaded).toBe(true);
  });

  test('should open popup with full lesson details when card is clicked', async ({ page }) => {
    await page.waitForSelector('[data-testid="lesson-card"]');
    
    const firstCard = page.locator('[data-testid="lesson-card"]').first();
    const titleText = await firstCard.locator('[data-testid="lesson-title"]').textContent();
    
    // Click the card
    await firstCard.click();
    
    // Wait for popup to open
    await page.waitForSelector('[data-testid="lesson-popup"]', { timeout: 5000 });
    
    const popup = page.locator('[data-testid="lesson-popup"]');
    await expect(popup).toBeVisible();
    
    // Check all information is displayed in popup
    await expect(popup.locator('[data-testid="popup-title"]')).toHaveText(titleText);
    await expect(popup.locator('[data-testid="popup-subject"]')).toBeVisible();
    await expect(popup.locator('[data-testid="popup-grade"]')).toBeVisible();
    await expect(popup.locator('[data-testid="popup-views"]')).toBeVisible();
    await expect(popup.locator('[data-testid="popup-description"]')).toBeVisible();
    await expect(popup.locator('[data-testid="popup-thumbnail"]')).toBeVisible();
    
    // Check full description is shown (not truncated)
    const fullDescription = await popup.locator('[data-testid="popup-description"]').textContent();
    expect(fullDescription.length).toBeGreaterThan(150); // Should be longer than truncated version
    
    // Check buttons
    await expect(popup.locator('[data-testid="confirm-button"]')).toBeVisible();
    await expect(popup.locator('[data-testid="return-button"]')).toBeVisible();
  });

  test('should navigate to lesson detail page when confirm button is clicked', async ({ page }) => {
    await page.waitForSelector('[data-testid="lesson-card"]');
    
    const firstCard = page.locator('[data-testid="lesson-card"]').first();
    const lessonId = await firstCard.getAttribute('data-lesson-id');
    
    await firstCard.click();
    await page.waitForSelector('[data-testid="lesson-popup"]');
    
    // Click confirm button
    await page.locator('[data-testid="confirm-button"]').click();
    
    // Should navigate to lesson detail page
    await expect(page).toHaveURL(new RegExp(`/lesson/${lessonId}`));
  });

  test('should close popup when return button is clicked', async ({ page }) => {
    await page.waitForSelector('[data-testid="lesson-card"]');
    
    const firstCard = page.locator('[data-testid="lesson-card"]').first();
    await firstCard.click();
    
    await page.waitForSelector('[data-testid="lesson-popup"]');
    const popup = page.locator('[data-testid="lesson-popup"]');
    await expect(popup).toBeVisible();
    
    // Click return button
    await page.locator('[data-testid="return-button"]').click();
    
    // Popup should be hidden
    await expect(popup).not.toBeVisible();
  });

  test('should have working search functionality with debounce', async ({ page }) => {
    await page.waitForSelector('[data-testid="search-input"]');
    
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Start intercepting API calls
    let apiCallCount = 0;
    page.on('request', request => {
      if (request.url().includes('/api/lessons') && request.url().includes('search=')) {
        apiCallCount++;
      }
    });
    
    // Type quickly to test debounce
    await searchInput.fill('physics test search');
    
    // Wait for debounce delay (assuming 500ms)
    await page.waitForTimeout(600);
    
    // Should only make one API call due to debounce
    expect(apiCallCount).toBe(1);
    
    // Verify search results update
    await page.waitForSelector('[data-testid="lesson-card"]');
    const results = page.locator('[data-testid="lesson-card"]');
    const count = await results.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should have all sort options working', async ({ page }) => {
    await page.waitForSelector('[data-testid="sort-select"]');
    
    const sortSelect = page.locator('[data-testid="sort-select"]');
    
    // Test each sort option
    const sortOptions = ['newest', 'oldest', 'a-z', 'z-a', 'most-views'];
    
    for (const option of sortOptions) {
      // Select sort option
      await sortSelect.selectOption(option);
      
      // Wait for API call with sort parameter
      const apiResponse = await page.waitForResponse(resp => 
        resp.url().includes('/api/lessons') && 
        resp.url().includes(`sort=${option}`) &&
        resp.status() === 200
      );
      
      const data = await apiResponse.json();
      expect(data.lessons).toBeDefined();
      
      // Verify lessons are sorted correctly
      if (option === 'a-z') {
        for (let i = 1; i < data.lessons.length; i++) {
          expect(data.lessons[i].title.localeCompare(data.lessons[i-1].title)).toBeGreaterThanOrEqual(0);
        }
      } else if (option === 'z-a') {
        for (let i = 1; i < data.lessons.length; i++) {
          expect(data.lessons[i].title.localeCompare(data.lessons[i-1].title)).toBeLessThanOrEqual(0);
        }
      } else if (option === 'most-views') {
        for (let i = 1; i < data.lessons.length; i++) {
          expect(data.lessons[i].views).toBeLessThanOrEqual(data.lessons[i-1].views);
        }
      }
    }
  });

  test('should have pagination with 12 lessons per page', async ({ page }) => {
    await page.waitForSelector('[data-testid="lesson-card"]');
    
    // Count lessons on first page
    const lessonsOnPage = await page.locator('[data-testid="lesson-card"]').count();
    expect(lessonsOnPage).toBeLessThanOrEqual(12);
    
    // Check pagination controls exist
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
    
    // Check if there's a next page button (if more than 12 lessons exist)
    const nextButton = page.locator('[data-testid="pagination-next"]');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      
      // Wait for new page to load
      await page.waitForResponse(resp => 
        resp.url().includes('/api/lessons') && 
        resp.url().includes('page=2')
      );
      
      // Verify URL updated
      expect(page.url()).toContain('page=2');
      
      // Verify lessons loaded for page 2
      await page.waitForSelector('[data-testid="lesson-card"]');
      const page2Lessons = await page.locator('[data-testid="lesson-card"]').count();
      expect(page2Lessons).toBeGreaterThan(0);
      expect(page2Lessons).toBeLessThanOrEqual(12);
    }
  });

  test('should have working tag filter with collision support', async ({ page }) => {
    await page.waitForSelector('[data-testid="tag-filter"]');
    
    // Get initial tag list
    const allTags = await page.locator('[data-testid="tag-option"]').allTextContents();
    expect(allTags.length).toBeGreaterThan(0);
    
    // Test single tag selection
    const firstTag = page.locator('[data-testid="tag-option"]').first();
    const firstTagText = await firstTag.textContent();
    await firstTag.click();
    
    // Wait for filtered results
    await page.waitForResponse(resp => 
      resp.url().includes('/api/lessons') && 
      resp.url().includes('tags=')
    );
    
    // Check that available tags updated (collision support)
    await page.waitForTimeout(500);
    const updatedTags = await page.locator('[data-testid="tag-option"]:not([disabled])').allTextContents();
    
    // Verify lessons are filtered
    const filteredLessons = page.locator('[data-testid="lesson-card"]');
    const lessonCount = await filteredLessons.count();
    
    // Each lesson should have the selected tag
    for (let i = 0; i < lessonCount; i++) {
      const lessonTags = await filteredLessons.nth(i).locator('[data-testid="lesson-tag"]').allTextContents();
      expect(lessonTags).toContain(firstTagText);
    }
    
    // Test multiple tag selection
    if (updatedTags.length > 0) {
      const secondTag = page.locator('[data-testid="tag-option"]:not([disabled])').first();
      const secondTagText = await secondTag.textContent();
      await secondTag.click();
      
      // Wait for updated results
      await page.waitForResponse(resp => 
        resp.url().includes('/api/lessons') && 
        resp.url().includes('tags=') &&
        resp.url().includes(encodeURIComponent(firstTagText)) &&
        resp.url().includes(encodeURIComponent(secondTagText))
      );
      
      // Verify lessons have both tags
      const multiFilteredLessons = page.locator('[data-testid="lesson-card"]');
      const multiLessonCount = await multiFilteredLessons.count();
      
      for (let i = 0; i < multiLessonCount; i++) {
        const lessonTags = await multiFilteredLessons.nth(i).locator('[data-testid="lesson-tag"]').allTextContents();
        expect(lessonTags).toContain(firstTagText);
        expect(lessonTags).toContain(secondTagText);
      }
    }
  });

  test('should show tags by popularity when no tag is selected', async ({ page }) => {
    await page.waitForSelector('[data-testid="tag-filter"]');
    
    // Get all tags with their counts
    const tagElements = page.locator('[data-testid="tag-option"]');
    const tagData = [];
    
    const tagCount = await tagElements.count();
    for (let i = 0; i < tagCount; i++) {
      const tag = tagElements.nth(i);
      const name = await tag.locator('[data-testid="tag-name"]').textContent();
      const count = await tag.locator('[data-testid="tag-count"]').textContent();
      tagData.push({ name, count: parseInt(count) });
    }
    
    // Verify tags are sorted by count (popularity)
    for (let i = 1; i < tagData.length; i++) {
      expect(tagData[i].count).toBeLessThanOrEqual(tagData[i-1].count);
    }
  });

  test('should follow Material Design and cosmetic requirements', async ({ page }) => {
    // Check Material Design colors
    const body = page.locator('body');
    const backgroundColor = await body.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    expect(backgroundColor).toMatch(/rgb\(255,\s*255,\s*255\)|rgb\(250,\s*250,\s*250\)|rgb\(245,\s*245,\s*245\)/);
    
    // Check shadcn/ui components
    const cards = page.locator('[data-testid="lesson-card"]');
    const firstCard = cards.first();
    const cardClasses = await firstCard.getAttribute('class');
    expect(cardClasses).toMatch(/rounded|shadow|border/);
    
    // Check for smooth animations
    const animatedElements = page.locator('[data-framer-motion], [style*="transform"], [style*="opacity"], [style*="transition"]');
    const animCount = await animatedElements.count();
    expect(animCount).toBeGreaterThan(0);
    
    // Check responsive design
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Verify mobile layout
    const mobileCards = await page.locator('[data-testid="lesson-card"]').count();
    expect(mobileCards).toBeGreaterThan(0);
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should handle loading and error states gracefully', async ({ page }) => {
    // Check loading state
    await page.goto('http://localhost:3000/lessons');
    
    // Should show loading indicator initially
    const loadingIndicator = page.locator('[data-testid="loading-spinner"], [data-testid="loading-skeleton"]');
    await expect(loadingIndicator).toBeVisible();
    
    // Wait for lessons to load
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 10000 });
    
    // Loading indicator should be hidden
    await expect(loadingIndicator).not.toBeVisible();
    
    // Test error handling by intercepting API with error
    await page.route('**/api/lessons*', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    await page.reload();
    
    // Should show error message
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/error|Error|không thể tải|failed/i);
  });
});