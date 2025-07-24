import { test, expect } from '@playwright/test';

// Mock lesson data
const mockLessons = {
  success: true,
  lessons: [
    {
      id: 1,
      title: 'Dao động cơ học',
      subject: 'Vật lý',
      grade: 12,
      description: 'Học về dao động điều hòa, con lắc lò xo, con lắc đơn và các ứng dụng trong thực tế. Bài học này sẽ giúp bạn hiểu rõ về các khái niệm cơ bản của dao động cơ học.',
      thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      tags: ['Dao động', 'Cơ học', 'Chương 1'],
      difficulty: 'medium',
      duration_minutes: 45,
      views: 1250,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z'
    },
    {
      id: 2,
      title: 'Sóng cơ học',
      subject: 'Vật lý',
      grade: 12,
      description: 'Tìm hiểu về sóng cơ, sóng âm, sóng dừng và giao thoa sóng. Bài học bao gồm nhiều ví dụ thực tế.',
      thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      tags: ['Sóng', 'Cơ học', 'Chương 2'],
      difficulty: 'hard',
      duration_minutes: 60,
      views: 890,
      created_at: '2024-01-16T10:00:00Z',
      updated_at: '2024-01-16T10:00:00Z'
    },
    {
      id: 3,
      title: 'Dòng điện xoay chiều',
      subject: 'Vật lý',
      grade: 12,
      description: 'Nghiên cứu về dòng điện xoay chiều, mạch RLC, công suất điện và hệ số công suất.',
      thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      tags: ['Điện', 'Xoay chiều', 'Chương 3'],
      difficulty: 'medium',
      duration_minutes: 50,
      views: 2100,
      created_at: '2024-01-17T10:00:00Z',
      updated_at: '2024-01-17T10:00:00Z'
    }
  ],
  total: 3,
  page: 1,
  limit: 12
};

test.describe('Lessons Page with Mock Data', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept API calls and return mock data
    await page.route('**/api/lessons*', async (route) => {
      const url = new URL(route.request().url());
      
      // Handle different query parameters
      if (url.searchParams.has('search')) {
        const search = url.searchParams.get('search').toLowerCase();
        const filtered = mockLessons.lessons.filter(lesson => 
          lesson.title.toLowerCase().includes(search) ||
          lesson.description.toLowerCase().includes(search)
        );
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...mockLessons, lessons: filtered, total: filtered.length })
        });
      } else if (url.searchParams.has('sort')) {
        const sort = url.searchParams.get('sort');
        let sorted = [...mockLessons.lessons];
        
        switch(sort) {
          case 'oldest':
            sorted.reverse();
            break;
          case 'az':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
          case 'za':
            sorted.sort((a, b) => b.title.localeCompare(a.title));
            break;
          case 'popular':
            sorted.sort((a, b) => b.views - a.views);
            break;
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...mockLessons, lessons: sorted })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockLessons)
        });
      }
    });
    
    await page.goto('http://localhost:3000/lessons');
    await page.waitForLoadState('networkidle');
  });

  test('should display lesson cards with all required information', async ({ page }) => {
    // Wait for lessons to load
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 10000 });
    
    const lessonCards = page.locator('[data-testid="lesson-card"]');
    const cardCount = await lessonCards.count();
    expect(cardCount).toBe(3);
    
    const firstCard = lessonCards.first();
    
    // Check all required elements are present
    await expect(firstCard.locator('[data-testid="lesson-title"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-subject"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-grade"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-views"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-description"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="lesson-thumbnail"]')).toBeVisible();
    
    // Verify content
    await expect(firstCard.locator('[data-testid="lesson-title"]')).toHaveText('Dao động cơ học');
    await expect(firstCard.locator('[data-testid="lesson-subject"]')).toHaveText('Vật lý');
    await expect(firstCard.locator('[data-testid="lesson-grade"]')).toHaveText('Lớp 12');
    await expect(firstCard.locator('[data-testid="lesson-views"]')).toContainText('1250');
  });

  test('should display base64 thumbnails correctly', async ({ page }) => {
    await page.waitForSelector('[data-testid="lesson-thumbnail"]');
    
    const thumbnail = page.locator('[data-testid="lesson-thumbnail"]').first();
    const src = await thumbnail.getAttribute('src');
    
    // Check if it's a base64 image
    expect(src).toMatch(/^data:image\/(png|jpg|jpeg|gif|webp);base64,/);
  });

  test('should have working search functionality', async ({ page }) => {
    await page.waitForSelector('[data-testid="search-input"]');
    
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Type search query
    await searchInput.fill('dao động');
    
    // Wait for search results
    await page.waitForTimeout(600); // Wait for debounce
    
    // Check that only matching lessons are shown
    const lessonCards = page.locator('[data-testid="lesson-card"]');
    await expect(lessonCards).toHaveCount(1);
    await expect(lessonCards.first().locator('[data-testid="lesson-title"]')).toHaveText('Dao động cơ học');
  });

  test('should have working sort functionality', async ({ page }) => {
    await page.waitForSelector('[data-testid="sort-select"]');
    
    // Sort by most views
    await page.locator('[data-testid="sort-select"]').click();
    await page.locator('text=Xem nhiều nhất').click();
    
    // Wait for re-render
    await page.waitForTimeout(500);
    
    // Check first lesson is the one with most views
    const firstTitle = await page.locator('[data-testid="lesson-card"]').first().locator('[data-testid="lesson-title"]').textContent();
    expect(firstTitle).toBe('Dòng điện xoay chiều'); // Has 2100 views
  });

  test('should open popup with lesson details', async ({ page }) => {
    await page.waitForSelector('[data-testid="lesson-card"]');
    
    const firstCard = page.locator('[data-testid="lesson-card"]').first();
    await firstCard.click();
    
    // Wait for popup
    await page.waitForSelector('[data-testid="lesson-popup"]', { timeout: 5000 });
    
    const popup = page.locator('[data-testid="lesson-popup"]');
    await expect(popup).toBeVisible();
    
    // Check popup content
    await expect(popup.locator('[data-testid="popup-title"]')).toHaveText('Dao động cơ học');
    await expect(popup.locator('[data-testid="popup-description"]')).toBeVisible();
    await expect(popup.locator('[data-testid="confirm-button"]')).toBeVisible();
    await expect(popup.locator('[data-testid="return-button"]')).toBeVisible();
  });

  test('should handle Material Design requirements', async ({ page }) => {
    // Check card styling
    const firstCard = page.locator('[data-testid="lesson-card"]').first();
    const cardClasses = await firstCard.getAttribute('class');
    expect(cardClasses).toMatch(/rounded|shadow|hover/);
    
    // Check for animations
    const hasMotionElements = await page.locator('[style*="transform"], [style*="transition"]').count();
    expect(hasMotionElements).toBeGreaterThan(0);
  });
});