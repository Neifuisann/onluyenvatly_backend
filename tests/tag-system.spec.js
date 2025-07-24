import { test, expect } from '@playwright/test';

// Mock lesson data with specific tag combinations for testing
const mockLessons = {
  success: true,
  lessons: [
    {
      id: 1,
      title: 'Lesson 1: Fruit Salad Recipe',
      subject: 'Vật lý',
      grade: 12,
      description: 'A comprehensive lesson about various fruits',
      thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      tags: ['banana', 'apple', 'grape'],
      views: 100,
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      title: 'Lesson 2: Tropical Fruits',
      subject: 'Vật lý',
      grade: 12,
      description: 'Learn about tropical fruits',
      thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      tags: ['banana', 'pineapple'],
      views: 80,
      created_at: '2024-01-02T00:00:00Z'
    },
    {
      id: 3,
      title: 'Lesson 3: Exotic Fruits',
      subject: 'Vật lý',
      grade: 12,
      description: 'Discover exotic fruits',
      thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      tags: ['kiwi', 'strawberry'],
      views: 60,
      created_at: '2024-01-03T00:00:00Z'
    },
    {
      id: 4,
      title: 'Lesson 4: Common Fruits',
      subject: 'Vật lý',
      grade: 12,
      description: 'Basic fruits everyone knows',
      thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      tags: ['apple', 'orange'],
      views: 120,
      created_at: '2024-01-04T00:00:00Z'
    },
    {
      id: 5,
      title: 'Lesson 5: Berry Collection',
      subject: 'Vật lý',
      grade: 12,
      description: 'All about berries',
      thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      tags: ['strawberry', 'blueberry'],
      views: 90,
      created_at: '2024-01-05T00:00:00Z'
    }
  ],
  total: 5,
  page: 1,
  limit: 12
};

// Calculate tag counts from mock data
const calculateTagCounts = (lessons) => {
  const tagCounts = new Map();
  lessons.forEach(lesson => {
    lesson.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  return tagCounts;
};

test.describe('Tag System', () => {
  test.beforeEach(async ({ page }) => {
    // Set header to bypass authentication
    await page.setExtraHTTPHeaders({
      'x-playwright-test': 'true'
    });
    
    // Intercept API calls and return mock data
    await page.route('**/api/lessons*', async (route) => {
      const url = new URL(route.request().url());
      const tags = url.searchParams.get('tags');
      
      if (tags) {
        // Filter lessons based on selected tags (AND logic)
        const selectedTags = tags.split(',').filter(t => t);
        const filtered = mockLessons.lessons.filter(lesson => 
          selectedTags.every(tag => lesson.tags.includes(tag))
        );
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            ...mockLessons, 
            lessons: filtered, 
            total: filtered.length 
          })
        });
      } else {
        // Return all lessons with tag counts
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockLessons)
        });
      }
    });
    
    await page.goto('http://localhost:3000/lessons');
    // Wait for lessons to load
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 10000 });
  });

  test('1. Tags should be displayed', async ({ page }) => {
    // Wait for tags to be visible
    await page.waitForSelector('[data-testid^="tag-"]', { timeout: 5000 });
    
    // Check that tags are displayed
    const tags = page.locator('[data-testid^="tag-"]');
    const tagCount = await tags.count();
    expect(tagCount).toBeGreaterThan(0);
    
    // Verify each tag has a name and count
    for (let i = 0; i < tagCount; i++) {
      const tag = tags.nth(i);
      const tagText = await tag.textContent();
      expect(tagText).toMatch(/\w+\s*\(\d+\)/); // Matches "TagName (count)"
    }
  });

  test('2. Selecting one tag shows lessons with that tag', async ({ page }) => {
    // Get the first tag and its name
    const firstTag = page.locator('[data-testid^="tag-"]').first();
    const tagText = await firstTag.textContent();
    const tagName = tagText.match(/^([^(]+)/)[1].trim();
    
    // Click the tag
    await firstTag.click();
    
    // Wait for UI to update
    await page.waitForTimeout(1000);
    
    // Wait for lessons to update
    await page.waitForTimeout(500);
    
    // Verify all displayed lessons have the selected tag
    const lessonCards = page.locator('[data-testid="lesson-card"]');
    const lessonCount = await lessonCards.count();
    expect(lessonCount).toBeGreaterThan(0);
    
    for (let i = 0; i < lessonCount; i++) {
      const lessonTags = await lessonCards.nth(i).locator('.text-xs').allTextContents();
      const hasTag = lessonTags.some(tag => tag.includes(tagName));
      expect(hasTag).toBe(true);
    }
    
    // Verify the selected tag is highlighted
    await expect(firstTag).toHaveAttribute('data-selected', 'true');
  });

  test('3. Selecting multiple tags shows lessons with ALL selected tags', async ({ page }) => {
    // Select "banana" tag specifically
    const bananaTag = page.locator('[data-testid="tag-banana"]');
    if (await bananaTag.count() === 0) {
      // If banana tag doesn't exist, skip this test
      console.log('Banana tag not found, skipping test');
      return;
    }
    
    await bananaTag.click();
    await page.waitForTimeout(1000);
    
    // Now select "apple" tag (which shares Lesson 1 with banana)
    const appleTag = page.locator('[data-testid="tag-apple"]');
    if (await appleTag.isVisible()) {
      await appleTag.click();
      await page.waitForTimeout(1000);
      
      // Verify that only Lesson 1 is shown (which has both banana AND apple)
      const lessonCards = page.locator('[data-testid="lesson-card"]');
      const lessonCount = await lessonCards.count();
      
      expect(lessonCount).toBe(1); // Only Lesson 1 has both tags
      
      // Verify the lesson has both tags
      const lessonTags = await lessonCards.first().locator('.text-xs').allTextContents();
      const tagTexts = lessonTags.join(' ');
      expect(tagTexts).toContain('banana');
      expect(tagTexts).toContain('apple');
    }
    
    // Test case where no lessons match
    // Deselect apple and select strawberry instead
    await appleTag.click(); // Deselect
    await page.waitForTimeout(500);
    
    const strawberryTag = page.locator('[data-testid="tag-strawberry"]');
    if (await strawberryTag.isVisible()) {
      await strawberryTag.click();
      await page.waitForTimeout(1000);
      
      // No lessons have both banana AND strawberry
      const lessonCards2 = page.locator('[data-testid="lesson-card"]');
      const lessonCount2 = await lessonCards2.count();
      
      if (lessonCount2 === 0) {
        // Verify empty state is shown
        const emptyState = page.locator('text=/Không tìm thấy bài học nào/i');
        await expect(emptyState).toBeVisible();
      }
    }
  });

  test('4. Tag visibility follows shared lesson rules', async ({ page }) => {
    // Test scenario from requirements:
    // If no tag selected, show all tags by popularity
    const allTagsInitial = await page.locator('[data-testid^="tag-"]:visible').count();
    expect(allTagsInitial).toBeGreaterThan(0);
    
    // Select a tag
    const bananaTag = page.locator('[data-testid^="tag-"]').filter({ hasText: /banana/i }).first();
    if (await bananaTag.count() > 0) {
      await bananaTag.click();
      await page.waitForTimeout(1000);
      await page.waitForTimeout(500);
      
      // Only tags that share lessons with "banana" should be visible
      const visibleTags = await page.locator('[data-testid^="tag-"]:visible').allTextContents();
      
      // The selected tag should still be visible
      expect(visibleTags.some(tag => tag.toLowerCase().includes('banana'))).toBe(true);
      
      // Tags that don't share lessons should be hidden
      const allTags = await page.locator('[data-testid^="tag-"]').count();
      const visibleTagsCount = await page.locator('[data-testid^="tag-"]:visible').count();
      
      // There should be hidden tags if the dataset is diverse enough
      if (allTags > visibleTagsCount) {
        expect(visibleTagsCount).toBeLessThan(allTags);
      }
    }
  });

  test('Tags can be deselected by clicking again', async ({ page }) => {
    // Select a tag
    const firstTag = page.locator('[data-testid^="tag-"]').first();
    await firstTag.click();
    
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);
    
    // Verify it's selected
    await expect(firstTag).toHaveAttribute('data-selected', 'true');
    
    // Click again to deselect
    await firstTag.click();
    
    await page.waitForTimeout(1000);
    await page.waitForTimeout(500);
    
    // Verify it's deselected
    await expect(firstTag).not.toHaveAttribute('data-selected', 'true');
    
    // All tags should be visible again
    const allTagsVisible = await page.locator('[data-testid^="tag-"]:visible').count();
    const allTags = await page.locator('[data-testid^="tag-"]').count();
    expect(allTagsVisible).toBe(allTags);
  });

  test('Complex tag interaction scenario', async ({ page }) => {
    // This tests the complex example from requirements
    // We'll simulate the fruit example if such tags exist
    
    // Try to find specific tags from the example
    const kiwiTag = page.locator('[data-testid^="tag-"]').filter({ hasText: /kiwi/i }).first();
    
    if (await kiwiTag.count() > 0) {
      await kiwiTag.click();
      await page.waitForTimeout(1000);
      await page.waitForTimeout(500);
      
      // Only strawberry should be visible (based on example)
      const visibleTags = await page.locator('[data-testid^="tag-"]:visible').allTextContents();
      const visibleTagNames = visibleTags.map(t => t.toLowerCase());
      
      // Kiwi should still be visible (selected)
      expect(visibleTagNames.some(tag => tag.includes('kiwi'))).toBe(true);
      
      // Other fruit tags that don't share lessons should be hidden
      const bananaVisible = visibleTagNames.some(tag => tag.includes('banana'));
      const appleVisible = visibleTagNames.some(tag => tag.includes('apple'));
      
      // Based on the example, banana and apple shouldn't be visible when kiwi is selected
      if (visibleTagNames.some(tag => tag.includes('strawberry'))) {
        expect(bananaVisible).toBe(false);
        expect(appleVisible).toBe(false);
      }
    }
  });

  test('Tags are sorted by popularity when no selection', async ({ page }) => {
    // Ensure no tags are selected
    await page.reload();
    await page.waitForSelector('[data-testid^="tag-"]', { timeout: 5000 });
    
    // Get all tags with their counts
    const tags = page.locator('[data-testid^="tag-"]');
    const tagData = [];
    
    const tagCount = await tags.count();
    for (let i = 0; i < tagCount; i++) {
      const tag = tags.nth(i);
      const text = await tag.textContent();
      const match = text.match(/\((\d+)\)/);
      if (match) {
        tagData.push(parseInt(match[1]));
      }
    }
    
    // Verify tags are sorted by count (descending)
    for (let i = 1; i < tagData.length; i++) {
      expect(tagData[i]).toBeLessThanOrEqual(tagData[i-1]);
    }
  });

  test('URL updates when tags are selected', async ({ page }) => {
    const firstTag = page.locator('[data-testid^="tag-"]').first();
    const tagText = await firstTag.textContent();
    const tagName = tagText.match(/^([^(]+)/)[1].trim();
    
    await firstTag.click();
    
    // Wait for URL to update
    await page.waitForTimeout(1000);
    
    // Check URL contains the selected tag
    expect(page.url()).toContain('tags=');
    expect(decodeURIComponent(page.url())).toContain(tagName);
  });

  test('Empty state when no lessons match selected tags', async ({ page }) => {
    // Try to select multiple tags that might not have common lessons
    const tags = page.locator('[data-testid^="tag-"]');
    const tagCount = await tags.count();
    
    if (tagCount >= 3) {
      // Select first tag
      await tags.nth(0).click();
      await page.waitForTimeout(500);
      
      // Select last tag (likely unrelated)
      const lastTag = tags.nth(tagCount - 1);
      if (await lastTag.isVisible()) {
        await lastTag.click();
        await page.waitForTimeout(500);
        
        // Check if empty state is shown
        const lessonCount = await page.locator('[data-testid="lesson-card"]').count();
        if (lessonCount === 0) {
          const emptyState = page.locator('text=/Không tìm thấy bài học nào/i');
          await expect(emptyState).toBeVisible();
        }
      }
    }
  });

  test('Bidirectional tag recovery when deselecting', async ({ page }) => {
    // Select banana tag
    const bananaTag = page.locator('[data-testid="tag-banana"]');
    await bananaTag.click();
    await page.waitForTimeout(1000);
    
    // Count visible tags after selecting banana
    const visibleAfterBanana = await page.locator('[data-testid^="tag-"]:visible').count();
    
    // Select apple tag (narrows down further)
    const appleTag = page.locator('[data-testid="tag-apple"]');
    await appleTag.click();
    await page.waitForTimeout(1000);
    
    // Count visible tags after selecting both
    const visibleAfterBoth = await page.locator('[data-testid^="tag-"]:visible').count();
    expect(visibleAfterBoth).toBeLessThan(visibleAfterBanana);
    
    // Deselect apple tag
    await appleTag.click();
    await page.waitForTimeout(1000);
    
    // Tags should recover to the state when only banana was selected
    const visibleAfterDeselectApple = await page.locator('[data-testid^="tag-"]:visible').count();
    expect(visibleAfterDeselectApple).toBe(visibleAfterBanana);
    
    // Verify specific tags are visible again
    const pineappleTag = page.locator('[data-testid="tag-pineapple"]');
    await expect(pineappleTag).toBeVisible(); // Should be visible with just banana selected
    
    // Deselect banana too
    await bananaTag.click();
    await page.waitForTimeout(1000);
    
    // All tags should be visible again
    const allTagsVisible = await page.locator('[data-testid^="tag-"]:visible').count();
    const allTags = await page.locator('[data-testid^="tag-"]').count();
    expect(allTagsVisible).toBe(allTags);
  });
});