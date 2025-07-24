import { test, expect } from '@playwright/test';

test.describe('Lesson Page', () => {
  let lessonId;
  let authCookie;

  test.beforeAll(async ({ request }) => {
    // Get CSRF token
    const csrfResponse = await request.get('http://localhost:3003/api/csrf-token');
    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.csrfToken;

    // Login as student
    const loginResponse = await request.post('http://localhost:3003/api/auth/login', {
      data: {
        username: '0375931007',
        password: '140207'
      },
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });

    expect(loginResponse.ok()).toBeTruthy();

    // Get auth cookie
    const cookies = await loginResponse.headers();
    authCookie = cookies['set-cookie'];

    // Get a lesson ID from the API
    const lessonsResponse = await request.get('http://localhost:3003/api/lessons?limit=1');
    const lessonsData = await lessonsResponse.json();
    expect(lessonsData.lessons).toHaveLength(1);
    lessonId = lessonsData.lessons[0].id;
  });

  test.beforeEach(async ({ page, context }) => {
    // Set auth cookie
    if (authCookie) {
      await context.addCookies([{
        name: 'connect.sid',
        value: authCookie.split('=')[1].split(';')[0],
        domain: 'localhost',
        path: '/',
        httpOnly: true
      }]);
    }

    // Navigate to lesson page (dynamic route)
    await page.goto(`http://localhost:3000/lesson/${lessonId}`);
  });

  test('should load lesson data from backend API', async ({ page }) => {
    // Intercept API call to verify it's made
    const apiResponse = page.waitForResponse(resp => 
      resp.url().includes(`/api/lessons/${lessonId}`) && resp.status() === 200
    );

    await page.reload();
    const response = await apiResponse;
    const data = await response.json();
    
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('lesson');
    expect(data.lesson).toHaveProperty('id', lessonId);
    expect(data.lesson).toHaveProperty('questions');
    expect(Array.isArray(data.lesson.questions)).toBe(true);
  });

  test('should display lesson title and navigation', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('[data-testid="lesson-title"]', { timeout: 10000 });
    
    // Check title is displayed
    await expect(page.locator('[data-testid="lesson-title"]')).toBeVisible();
    
    // Check question navigation
    await expect(page.locator('[data-testid="question-navigation"]')).toBeVisible();
    const questionButtons = page.locator('[data-testid^="question-nav-"]');
    const count = await questionButtons.count();
    expect(count).toBeGreaterThan(0);
    
    // Check submit button is always visible in top right
    const submitButton = page.locator('[data-testid="submit-button"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toHaveCSS('position', 'fixed');
    
    // Verify submit button is in top right
    const box = await submitButton.boundingBox();
    expect(box.x).toBeGreaterThan(page.viewportSize().width - 200);
    expect(box.y).toBeLessThan(100);
  });

  test('should display and handle ABCD questions correctly', async ({ page }) => {
    // Wait for questions to load
    await page.waitForSelector('[data-testid="question-content"]');
    
    // Find an ABCD question
    const questions = page.locator('[data-testid="question-content"]');
    let abcdQuestionIndex = -1;
    
    for (let i = 0; i < await questions.count(); i++) {
      const questionType = await page.locator(`[data-testid="question-type-${i}"]`).getAttribute('data-type');
      if (questionType === 'ABCD') {
        abcdQuestionIndex = i;
        break;
      }
    }
    
    if (abcdQuestionIndex >= 0) {
      // Navigate to ABCD question
      await page.click(`[data-testid="question-nav-${abcdQuestionIndex}"]`);
      
      // Check question content is displayed
      await expect(page.locator(`[data-testid="question-content-${abcdQuestionIndex}"]`)).toBeVisible();
      
      // Check 4 choices are displayed
      const choices = page.locator(`[data-testid^="choice-${abcdQuestionIndex}-"]`);
      expect(await choices.count()).toBe(4);
      
      // Check choices have labels A, B, C, D
      for (let i = 0; i < 4; i++) {
        const choiceLabel = String.fromCharCode(65 + i); // A, B, C, D
        await expect(page.locator(`[data-testid="choice-${abcdQuestionIndex}-${choiceLabel}"]`)).toBeVisible();
      }
      
      // Test selecting a choice
      await page.click(`[data-testid="choice-${abcdQuestionIndex}-A"]`);
      await expect(page.locator(`[data-testid="choice-${abcdQuestionIndex}-A"]`)).toHaveAttribute('data-selected', 'true');
    }
  });

  test('should display and handle TRUEFALSE questions correctly', async ({ page }) => {
    await page.waitForSelector('[data-testid="question-content"]');
    
    const questions = page.locator('[data-testid="question-content"]');
    let trueFalseQuestionIndex = -1;
    
    for (let i = 0; i < await questions.count(); i++) {
      const questionType = await page.locator(`[data-testid="question-type-${i}"]`).getAttribute('data-type');
      if (questionType === 'TRUEFALSE') {
        trueFalseQuestionIndex = i;
        break;
      }
    }
    
    if (trueFalseQuestionIndex >= 0) {
      await page.click(`[data-testid="question-nav-${trueFalseQuestionIndex}"]`);
      
      // Check question content
      await expect(page.locator(`[data-testid="question-content-${trueFalseQuestionIndex}"]`)).toBeVisible();
      
      // Check True/False layout matches screenshot (horizontal buttons)
      const trueFalseContainer = page.locator(`[data-testid="truefalse-container-${trueFalseQuestionIndex}"]`);
      await expect(trueFalseContainer).toBeVisible();
      
      // Check both buttons exist
      await expect(page.locator(`[data-testid="choice-${trueFalseQuestionIndex}-true"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="choice-${trueFalseQuestionIndex}-true"]`)).toContainText('Đúng');
      await expect(page.locator(`[data-testid="choice-${trueFalseQuestionIndex}-false"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="choice-${trueFalseQuestionIndex}-false"]`)).toContainText('Sai');
      
      // Test selecting true/false
      await page.click(`[data-testid="choice-${trueFalseQuestionIndex}-true"]`);
      await expect(page.locator(`[data-testid="choice-${trueFalseQuestionIndex}-true"]`)).toHaveAttribute('data-selected', 'true');
    }
  });

  test('should display and handle short number questions correctly', async ({ page }) => {
    await page.waitForSelector('[data-testid="question-content"]');
    
    const questions = page.locator('[data-testid="question-content"]');
    let numberQuestionIndex = -1;
    
    for (let i = 0; i < await questions.count(); i++) {
      const questionType = await page.locator(`[data-testid="question-type-${i}"]`).getAttribute('data-type');
      if (questionType === 'NUMBER') {
        numberQuestionIndex = i;
        break;
      }
    }
    
    if (numberQuestionIndex >= 0) {
      await page.click(`[data-testid="question-nav-${numberQuestionIndex}"]`);
      
      // Check input field exists
      const numberInput = page.locator(`[data-testid="number-input-${numberQuestionIndex}"]`);
      await expect(numberInput).toBeVisible();
      await expect(numberInput).toHaveAttribute('type', 'number');
      
      // Test entering a number
      await numberInput.fill('42');
      await expect(numberInput).toHaveValue('42');
    }
  });

  test('should navigate between questions', async ({ page }) => {
    await page.waitForSelector('[data-testid="question-navigation"]');
    
    // Get total questions
    const questionButtons = page.locator('[data-testid^="question-nav-"]');
    const totalQuestions = await questionButtons.count();
    
    if (totalQuestions > 1) {
      // Click second question
      await page.click('[data-testid="question-nav-1"]');
      await expect(page.locator('[data-testid="question-nav-1"]')).toHaveAttribute('data-active', 'true');
      
      // Check navigation buttons
      await expect(page.locator('[data-testid="prev-question"]')).toBeVisible();
      await expect(page.locator('[data-testid="next-question"]')).toBeVisible();
      
      // Navigate using buttons
      await page.click('[data-testid="prev-question"]');
      await expect(page.locator('[data-testid="question-nav-0"]')).toHaveAttribute('data-active', 'true');
      
      await page.click('[data-testid="next-question"]');
      await expect(page.locator('[data-testid="question-nav-1"]')).toHaveAttribute('data-active', 'true');
    }
  });

  test('should render LaTeX content correctly', async ({ page }) => {
    await page.waitForSelector('[data-testid="question-content"]');
    
    // Check for inline LaTeX
    const inlineLatex = page.locator('[data-testid="latex-inline"]').first();
    if (await inlineLatex.count() > 0) {
      await expect(inlineLatex).toBeVisible();
      // Check if KaTeX or MathJax rendered it
      const hasRenderedMath = await inlineLatex.locator('.katex, .MathJax').count() > 0;
      expect(hasRenderedMath).toBe(true);
    }
    
    // Check for block LaTeX
    const blockLatex = page.locator('[data-testid="latex-block"]').first();
    if (await blockLatex.count() > 0) {
      await expect(blockLatex).toBeVisible();
      const hasRenderedMath = await blockLatex.locator('.katex, .MathJax').count() > 0;
      expect(hasRenderedMath).toBe(true);
    }
  });

  test('should display images for questions that have them', async ({ page }) => {
    await page.waitForSelector('[data-testid="question-content"]');
    
    // Look for question with image
    const questionImages = page.locator('[data-testid^="question-image-"]');
    
    if (await questionImages.count() > 0) {
      const firstImage = questionImages.first();
      await expect(firstImage).toBeVisible();
      
      // Check image is loaded
      const isLoaded = await firstImage.evaluate((img) => {
        return img.complete && img.naturalHeight > 0;
      });
      expect(isLoaded).toBe(true);
      
      // Check image container has proper styling
      const imageContainer = page.locator('[data-testid="question-image-container"]').first();
      await expect(imageContainer).toBeVisible();
    }
  });

  test('should show confirmation popup when submit is clicked', async ({ page }) => {
    await page.waitForSelector('[data-testid="submit-button"]');
    
    // Answer at least one question
    const firstChoice = page.locator('[data-testid^="choice-0-"]').first();
    if (await firstChoice.count() > 0) {
      await firstChoice.click();
    }
    
    // Click submit button
    await page.click('[data-testid="submit-button"]');
    
    // Check confirmation popup appears
    await expect(page.locator('[data-testid="submit-confirmation-popup"]')).toBeVisible();
    
    // Check popup content matches screenshot
    await expect(page.locator('[data-testid="confirmation-title"]')).toContainText('Xác nhận nộp bài');
    await expect(page.locator('[data-testid="confirmation-message"]')).toContainText('Bạn có chắc chắn muốn nộp bài không?');
    
    // Check statistics in popup
    await expect(page.locator('[data-testid="answered-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="unanswered-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="flagged-count"]')).toBeVisible();
    
    // Check buttons
    await expect(page.locator('[data-testid="cancel-submit"]')).toBeVisible();
    await expect(page.locator('[data-testid="cancel-submit"]')).toContainText('Quay lại');
    await expect(page.locator('[data-testid="confirm-submit"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-submit"]')).toContainText('Nộp bài');
  });

  test('should submit test and redirect to results page', async ({ page }) => {
    await page.waitForSelector('[data-testid="submit-button"]');
    
    // Answer some questions
    const choices = page.locator('[data-testid^="choice-"]');
    const choiceCount = await choices.count();
    if (choiceCount > 0) {
      // Answer first 3 questions or all if less than 3
      const answersToGive = Math.min(3, choiceCount);
      for (let i = 0; i < answersToGive; i++) {
        await choices.nth(i).click();
      }
    }
    
    // Intercept submit API call
    const submitResponse = page.waitForResponse(resp => 
      resp.url().includes('/api/results') && resp.method() === 'POST'
    );
    
    // Click submit and confirm
    await page.click('[data-testid="submit-button"]');
    await page.waitForSelector('[data-testid="confirm-submit"]');
    await page.click('[data-testid="confirm-submit"]');
    
    // Wait for API response
    const response = await submitResponse;
    expect(response.status()).toBe(201);
    
    const responseData = await response.json();
    expect(responseData).toHaveProperty('success', true);
    expect(responseData).toHaveProperty('resultId');
    
    // Check redirect to results page
    await page.waitForURL(/\/results\/[^/]+$/);
    const currentUrl = page.url();
    expect(currentUrl).toContain('/results/');
    expect(currentUrl).toContain(responseData.resultId);
  });

  test('should handle timer display', async ({ page }) => {
    await page.waitForSelector('[data-testid="timer-display"]');
    
    const timer = page.locator('[data-testid="timer-display"]');
    await expect(timer).toBeVisible();
    
    // Check timer format (MM:SS)
    const timerText = await timer.textContent();
    expect(timerText).toMatch(/^\d{2}:\d{2}$/);
    
    // Wait 2 seconds and check timer increased
    const initialTime = timerText;
    await page.waitForTimeout(2000);
    const newTime = await timer.textContent();
    expect(newTime).not.toBe(initialTime);
  });

  test('should apply Material Design styling', async ({ page }) => {
    // Check for Material Design components
    await page.waitForSelector('[data-testid="lesson-container"]');
    
    // Check elevation/shadow on cards
    const cards = page.locator('[data-testid="question-card"]');
    if (await cards.count() > 0) {
      const boxShadow = await cards.first().evaluate(el => 
        window.getComputedStyle(el).boxShadow
      );
      expect(boxShadow).not.toBe('none');
    }
    
    // Check button styling
    const buttons = page.locator('button');
    const firstButton = buttons.first();
    const borderRadius = await firstButton.evaluate(el => 
      window.getComputedStyle(el).borderRadius
    );
    expect(parseInt(borderRadius)).toBeGreaterThan(0);
    
    // Check color scheme
    const primaryButton = page.locator('[data-testid="submit-button"]');
    const backgroundColor = await primaryButton.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    // Should have a color (not transparent)
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});