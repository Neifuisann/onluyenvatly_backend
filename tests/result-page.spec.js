import { test, expect } from '@playwright/test';

// Constants
const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3003';
const ADMIN_CREDENTIALS = { username: 'admin', password: 'hoff' };
const STUDENT_CREDENTIALS = { username: '0375931007', password: '140207' };

// Helper function to authenticate
async function authenticateUser(page, credentials, isAdmin = false) {
  // Login
  const loginEndpoint = isAdmin ? '/api/auth/admin/login' : '/api/auth/login';
  
  // Format credentials correctly for API
  const loginData = isAdmin ? credentials : {
    phone_number: credentials.username,
    password: credentials.password,
    device_id: 'test-device-playwright-' + Math.random().toString(36).substr(2, 9)
  };
  
  const loginResponse = await page.request.post(`${API_URL}${loginEndpoint}`, {
    data: loginData,
    headers: {
      'X-Device-ID': loginData.device_id || 'test-device-admin'
    }
  });
  
  if (!loginResponse.ok()) {
    const errorData = await loginResponse.json();
    console.error('Login failed:', errorData);
    throw new Error(`Login failed: ${errorData.message || errorData.error}`);
  }

  // Get CSRF token for subsequent requests
  const csrfResponse = await page.request.get(`${API_URL}/api/csrf-token`);
  const { csrfToken } = await csrfResponse.json();
  
  return csrfToken;
}

// Helper to create mock result data
function createMockResult() {
  return {
    id: 'test-result-123',
    lesson_id: 'lesson-456',
    student_id: 'student-789',
    score: 7.5,
    total_points: 10,
    timestamp: new Date().toISOString(),
    questions: [
      {
        questionId: 'q1',
        answer: 'B',
        type: 'ABCD',
        points: 2,
        earnedPoints: 2,
        isCorrect: true
      },
      {
        questionId: 'q2', 
        answer: 'A',
        type: 'ABCD',
        points: 2,
        earnedPoints: 0,
        isCorrect: false
      },
      {
        questionId: 'q3',
        answer: true,
        type: 'TRUEFALSE',
        points: 2,
        earnedPoints: 2,
        isCorrect: true
      },
      {
        questionId: 'q4',
        answer: 42,
        type: 'NUMBER',
        points: 2,
        earnedPoints: 0,
        isCorrect: false
      },
      {
        questionId: 'q5',
        answer: 'C',
        type: 'ABCD',
        points: 2,
        earnedPoints: 1.5,
        isCorrect: true
      }
    ],
    student_info: {
      id: 'student-789',
      username: '0375931007'
    },
    time_taken: 300,
    mode: 'test'
  };
}

// Mock lesson data with questions
function createMockLesson() {
  return {
    id: 'lesson-456',
    title: 'Chuyển động thẳng đều',
    questions: [
      {
        id: 'q1',
        type: 'ABCD',
        question: 'Vận tốc của vật chuyển động thẳng đều là:',
        choices: ['Thay đổi theo thời gian', 'Không đổi theo thời gian', 'Tăng dần', 'Giảm dần'],
        correctAnswer: 'B',
        points: 2,
        explanation: 'Trong chuyển động thẳng đều, vận tốc không thay đổi theo thời gian.'
      },
      {
        id: 'q2',
        type: 'ABCD', 
        question: 'Đơn vị của vận tốc trong hệ SI là:',
        choices: ['m/s', 'km/h', 'cm/s', 'mph'],
        correctAnswer: 'A',
        points: 2,
        explanation: 'Trong hệ SI, đơn vị của vận tốc là mét trên giây (m/s).'
      },
      {
        id: 'q3',
        type: 'TRUEFALSE',
        question: 'Quãng đường đi được trong chuyển động thẳng đều tỉ lệ thuận với thời gian.',
        correctAnswer: true,
        points: 2,
        explanation: 'Đúng. Công thức s = v.t cho thấy mối quan hệ tỉ lệ thuận.'
      },
      {
        id: 'q4',
        type: 'NUMBER',
        question: 'Một vật chuyển động với vận tốc 10 m/s trong 5 giây. Quãng đường đi được là bao nhiêu mét?',
        correctAnswer: 50,
        points: 2,
        explanation: 'Áp dụng công thức s = v.t = 10 × 5 = 50m'
      },
      {
        id: 'q5',
        type: 'ABCD',
        question: 'Đồ thị vận tốc - thời gian của chuyển động thẳng đều có dạng:',
        choices: ['Đường cong', 'Đường thẳng nằm ngang', 'Đường thẳng xiên lên', 'Đường thẳng xiên xuống'],
        correctAnswer: 'B',
        points: 2,
        explanation: 'Vì vận tốc không đổi nên đồ thị là đường thẳng song song với trục thời gian.',
        image: '/images/velocity-time-graph.png'
      }
    ]
  };
}

test.describe('Result Page Tests', () => {
  let csrfToken;

  test.beforeEach(async ({ page }) => {
    // Authenticate as student
    csrfToken = await authenticateUser(page, STUDENT_CREDENTIALS);
  });

  test('should display result correctly with all required elements', async ({ page }) => {
    // Navigate to result page
    const resultId = 'test-result-123';
    await page.goto(`${BASE_URL}/results/${resultId}`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // 1. Check if result is displayed correctly
    await expect(page.locator('[data-testid="result-container"]')).toBeVisible();

    // 2. Check if score is displayed
    await expect(page.locator('[data-testid="score-display"]')).toContainText('7.5/10');
    await expect(page.locator('[data-testid="score-percentage"]')).toContainText('75%');

    // 3. Check if lesson name is displayed
    await expect(page.locator('[data-testid="lesson-title"]')).toContainText('Chuyển động thẳng đều');

    // 4. Check if questions and choices are displayed
    const questionCards = page.locator('[data-testid^="question-card-"]');
    await expect(questionCards).toHaveCount(5);

    // Check first question (correct ABCD)
    const q1Card = page.locator('[data-testid="question-card-q1"]');
    await expect(q1Card.locator('[data-testid="question-text"]')).toContainText('Vận tốc của vật chuyển động thẳng đều là:');
    await expect(q1Card.locator('[data-testid="choice-A"]')).toContainText('Thay đổi theo thời gian');
    await expect(q1Card.locator('[data-testid="choice-B"]')).toContainText('Không đổi theo thời gian');
    
    // 5. Check correct answer is marked
    await expect(q1Card.locator('[data-testid="choice-B"]')).toHaveClass(/correct-answer/);
    await expect(q1Card.locator('[data-testid="choice-B"]')).toHaveClass(/user-selected/);

    // 6. Check incorrect answer marking
    const q2Card = page.locator('[data-testid="question-card-q2"]');
    await expect(q2Card.locator('[data-testid="choice-A"]')).toHaveClass(/correct-answer/);
    await expect(q2Card.locator('[data-testid="choice-A"]')).toHaveClass(/user-selected/);
    await expect(q2Card.locator('[data-testid="choice-A"]')).toHaveClass(/incorrect/);

    // Check true/false question
    const q3Card = page.locator('[data-testid="question-card-q3"]');
    await expect(q3Card.locator('[data-testid="answer-true"]')).toHaveClass(/correct-answer/);

    // Check number question
    const q4Card = page.locator('[data-testid="question-card-q4"]');
    await expect(q4Card.locator('[data-testid="user-answer"]')).toContainText('42');
    await expect(q4Card.locator('[data-testid="correct-answer"]')).toContainText('50');
  });

  test('should have working sorting dropdown', async ({ page }) => {
    await page.goto(`${BASE_URL}/results/test-result-123`);
    await page.waitForLoadState('networkidle');

    // 7. Check sorting dropdown
    const sortDropdown = page.locator('[data-testid="sort-dropdown"]');
    await expect(sortDropdown).toBeVisible();

    // Test all sort options
    await sortDropdown.selectOption('all');
    await expect(page.locator('[data-testid^="question-card-"]')).toHaveCount(5);

    await sortDropdown.selectOption('correct');
    const correctQuestions = page.locator('[data-testid^="question-card-"].correct');
    await expect(correctQuestions).toHaveCount(3);

    await sortDropdown.selectOption('incorrect');
    const incorrectQuestions = page.locator('[data-testid^="question-card-"].incorrect');
    await expect(incorrectQuestions).toHaveCount(2);
  });

  test('should have working AI explain functionality', async ({ page }) => {
    await page.goto(`${BASE_URL}/results/test-result-123`);
    await page.waitForLoadState('networkidle');

    // 8. Test AI explain button
    const firstQuestion = page.locator('[data-testid="question-card-q1"]');
    const explainButton = firstQuestion.locator('[data-testid="ai-explain-button"]');
    await expect(explainButton).toBeVisible();
    await expect(explainButton).toContainText('Giải thích AI');

    // Mock AI response
    await page.route('**/api/explain', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            explanation: `## Phân tích câu hỏi
Câu hỏi yêu cầu xác định đặc điểm của vận tốc trong chuyển động thẳng đều.

## Công thức liên quan
- Chuyển động thẳng đều: $v = \\text{const}$
- Quãng đường: $s = v \\cdot t$

## Giải thích
Trong chuyển động thẳng đều, vận tốc **không thay đổi** theo thời gian. Đây là đặc điểm quan trọng nhất của loại chuyển động này.

## Kết luận
Đáp án đúng là **B**: Không đổi theo thời gian.`
          }
        })
      });
    });

    // Click explain button
    await explainButton.click();

    // 9. Check AI response display
    const explanationSection = firstQuestion.locator('[data-testid="ai-explanation"]');
    await expect(explanationSection).toBeVisible();
    
    // Check if it's collapsible
    await expect(explanationSection).toHaveAttribute('data-collapsed', 'false');
    
    // Check LaTeX rendering
    await expect(explanationSection.locator('.katex')).toBeVisible();
    await expect(explanationSection).toContainText('Công thức liên quan');
    
    // Check markdown rendering
    await expect(explanationSection.locator('h2')).toContainText('Phân tích câu hỏi');
    await expect(explanationSection.locator('strong')).toContainText('không thay đổi');

    // Test collapse functionality
    const collapseButton = explanationSection.locator('[data-testid="collapse-button"]');
    await collapseButton.click();
    await expect(explanationSection).toHaveAttribute('data-collapsed', 'true');
  });

  test('should display images correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/results/test-result-123`);
    await page.waitForLoadState('networkidle');

    // 10. Check image display
    const q5Card = page.locator('[data-testid="question-card-q5"]');
    const questionImage = q5Card.locator('[data-testid="question-image"]');
    
    await expect(questionImage).toBeVisible();
    await expect(questionImage).toHaveAttribute('src', '/images/velocity-time-graph.png');
    await expect(questionImage).toHaveAttribute('alt', 'Question image');
    
    // Check image loading
    const imageLoaded = await questionImage.evaluate((img) => {
      return img.complete && img.naturalHeight !== 0;
    });
    expect(imageLoaded).toBeTruthy();
  });

  test('should have optimized mobile view', async ({ page }) => {
    // 11. Test mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/results/test-result-123`);
    await page.waitForLoadState('networkidle');

    // Check mobile-specific layout
    const container = page.locator('[data-testid="result-container"]');
    await expect(container).toHaveClass(/mobile-optimized/);

    // Check question cards stack vertically
    const questionCards = page.locator('[data-testid^="question-card-"]');
    const firstCardBox = await questionCards.first().boundingBox();
    const secondCardBox = await questionCards.nth(1).boundingBox();
    
    expect(firstCardBox.y).toBeLessThan(secondCardBox.y);
    expect(firstCardBox.width).toBeCloseTo(secondCardBox.width, 5);

    // Check touch-friendly buttons
    const explainButtons = page.locator('[data-testid="ai-explain-button"]');
    const firstButtonBox = await explainButtons.first().boundingBox();
    
    // Minimum touch target size (44x44 pixels)
    expect(firstButtonBox.height).toBeGreaterThanOrEqual(44);
    expect(firstButtonBox.width).toBeGreaterThanOrEqual(44);

    // Check collapsible sections work on mobile
    const firstExplainButton = explainButtons.first();
    await firstExplainButton.tap();
    
    const explanationSection = page.locator('[data-testid="ai-explanation"]').first();
    await expect(explanationSection).toBeVisible();

    // Check horizontal scrolling is prevented
    const bodyOverflow = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflowX;
    });
    expect(bodyOverflow).toBe('hidden');
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/results/**', route => route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Result not found' })
    }));

    await page.goto(`${BASE_URL}/results/invalid-id`);
    
    // Check error display
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Result not found');
    await expect(page.locator('[data-testid="back-button"]')).toBeVisible();
  });

  test('should handle AI explain errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/results/test-result-123`);
    await page.waitForLoadState('networkidle');

    // Mock AI error
    await page.route('**/api/explain', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'AI service unavailable' })
    }));

    const explainButton = page.locator('[data-testid="ai-explain-button"]').first();
    await explainButton.click();

    // Check error message
    await expect(page.locator('[data-testid="ai-error-message"]')).toContainText('AI service unavailable');
  });
});

// Performance tests
test.describe('Result Page Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(`${BASE_URL}/results/test-result-123`);
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
  });

  test('should handle large result sets', async ({ page }) => {
    // Create result with many questions
    const largeResult = createMockResult();
    largeResult.questions = Array(50).fill(null).map((_, i) => ({
      questionId: `q${i}`,
      answer: 'A',
      type: 'ABCD',
      points: 1,
      earnedPoints: i % 2 === 0 ? 1 : 0,
      isCorrect: i % 2 === 0
    }));

    await page.goto(`${BASE_URL}/results/large-result`);
    await page.waitForLoadState('networkidle');

    // Should implement pagination or virtual scrolling
    const visibleQuestions = await page.locator('[data-testid^="question-card-"]').count();
    expect(visibleQuestions).toBeLessThanOrEqual(20); // Should paginate or virtualize
  });
});