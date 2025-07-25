import { test, expect } from '@playwright/test';

// Seeded random number generator for consistent shuffling
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

// Shuffle array using seeded random
function shuffleArray(array, random) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Apply question shuffling logic
function applyQuestionShuffling(questions, seed) {
  const random = new SeededRandom(seed);
  
  // Group questions by type
  const abcdQuestions = questions.filter(q => q.type === 'ABCD');
  const trueFalseQuestions = questions.filter(q => q.type === 'TRUEFALSE');
  const numberQuestions = questions.filter(q => q.type === 'NUMBER');
  
  // Shuffle each group
  const shuffledAbcd = shuffleArray(abcdQuestions, random);
  const shuffledTrueFalse = shuffleArray(trueFalseQuestions, random);
  const shuffledNumber = shuffleArray(numberQuestions, random);
  
  // Combine in order: ABCD -> TRUEFALSE -> NUMBER
  return [...shuffledAbcd, ...shuffledTrueFalse, ...shuffledNumber];
}

// Apply answer shuffling logic
function applyAnswerShuffling(question, seed) {
  if (question.type === 'NUMBER' || !question.options) {
    return question;
  }
  
  const random = new SeededRandom(seed + question.id.charCodeAt(0));
  const shuffledOptions = shuffleArray(question.options, random);
  
  return {
    ...question,
    options: shuffledOptions
  };
}

test.describe('Lesson Page - Shuffling and Timer Features', () => {
  let authCookie;

  test.beforeAll(async ({ request }) => {
    // Get CSRF token
    const csrfResponse = await request.get('http://localhost:3003/api/csrf-token');
    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.csrfToken;

    // Login as student
    const loginResponse = await request.post('http://localhost:3003/api/auth/login', {
      data: {
        phone_number: '0375931007',
        password: '140207',
        deviceId: 'playwright-test-device'
      },
      headers: {
        'X-CSRF-Token': csrfToken,
        'X-Device-Id': 'playwright-test-device'
      }
    });

    expect(loginResponse.ok()).toBeTruthy();

    // Get auth cookie
    const cookies = await loginResponse.headers();
    authCookie = cookies['set-cookie'];
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
  });

  test('should correctly shuffle questions while maintaining type order', async ({ page }) => {
    // Mock lesson with shuffleQuestions enabled
    const mockLesson = {
      id: 'test-shuffle-1',
      title: 'Test Shuffling Lesson',
      subject: 'Physics',
      grade: '12',
      shuffleQuestions: true,
      shuffleAnswers: false,
      randomizationSeed: 12345,
      questions: [
        { id: 'q1', type: 'ABCD', question: 'ABCD Question 1', options: ['A', 'B', 'C', 'D'], points: 1 },
        { id: 'q2', type: 'ABCD', question: 'ABCD Question 2', options: ['A', 'B', 'C', 'D'], points: 1 },
        { id: 'q3', type: 'ABCD', question: 'ABCD Question 3', options: ['A', 'B', 'C', 'D'], points: 1 },
        { id: 'q4', type: 'TRUEFALSE', question: 'True/False Question 1', options: ['True', 'False'], points: 1 },
        { id: 'q5', type: 'TRUEFALSE', question: 'True/False Question 2', options: ['True', 'False'], points: 1 },
        { id: 'q6', type: 'NUMBER', question: 'Number Question 1', points: 1 }
      ]
    };

    // Intercept API and return mock data
    await page.route(`**/api/lessons/**`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          lesson: mockLesson
        })
      });
    });

    await page.goto(`http://localhost:3000/lesson/${mockLesson.id}`);
    await page.waitForSelector('[data-testid="lesson-title"]');

    // Get the displayed question order
    const questionNavButtons = page.locator('[data-testid^="question-nav-"]');
    const questionCount = await questionNavButtons.count();
    
    const displayedQuestions = [];
    for (let i = 0; i < questionCount; i++) {
      await page.click(`[data-testid="question-nav-${i}"]`);
      await page.waitForSelector('[data-testid="question-content"]');
      
      const questionType = await page.locator(`[data-testid="question-type-${i}"]`).getAttribute('data-type');
      const questionText = await page.locator('[data-testid="question-content"]').textContent();
      
      displayedQuestions.push({ type: questionType, text: questionText });
    }

    // Apply expected shuffling
    const expectedOrder = applyQuestionShuffling(mockLesson.questions, mockLesson.randomizationSeed);

    // Verify type order is maintained: all ABCD, then all TRUEFALSE, then all NUMBER
    const types = displayedQuestions.map(q => q.type);
    const abcdCount = types.filter(t => t === 'ABCD').length;
    const trueFalseCount = types.filter(t => t === 'TRUEFALSE').length;
    const numberCount = types.filter(t => t === 'NUMBER').length;

    // Check that all ABCD questions come first
    for (let i = 0; i < abcdCount; i++) {
      expect(types[i]).toBe('ABCD');
    }

    // Check that all TRUEFALSE questions come next
    for (let i = abcdCount; i < abcdCount + trueFalseCount; i++) {
      expect(types[i]).toBe('TRUEFALSE');
    }

    // Check that all NUMBER questions come last
    for (let i = abcdCount + trueFalseCount; i < types.length; i++) {
      expect(types[i]).toBe('NUMBER');
    }

    // Verify questions within each type are shuffled (not in original order)
    const originalAbcdOrder = mockLesson.questions.filter(q => q.type === 'ABCD').map(q => q.question);
    const displayedAbcdOrder = displayedQuestions.filter(q => q.type === 'ABCD').map(q => q.text);
    
    // Should be shuffled (not equal to original)
    expect(displayedAbcdOrder).not.toEqual(originalAbcdOrder);
  });

  test('should correctly shuffle answers for ABCD and TRUEFALSE questions', async ({ page }) => {
    // Mock lesson with shuffleAnswers enabled
    const mockLesson = {
      id: 'test-shuffle-2',
      title: 'Test Answer Shuffling',
      subject: 'Physics',
      grade: '12',
      shuffleQuestions: false,
      shuffleAnswers: true,
      randomizationSeed: 67890,
      questions: [
        { 
          id: 'q1', 
          type: 'ABCD', 
          question: 'Which is correct?', 
          options: ['Option A', 'Option B', 'Option C', 'Option D'], 
          points: 1 
        },
        { 
          id: 'q2', 
          type: 'TRUEFALSE', 
          question: 'Statement with choices', 
          options: ['Statement 1', 'Statement 2', 'Statement 3', 'Statement 4'], 
          points: 1 
        },
        { 
          id: 'q3', 
          type: 'NUMBER', 
          question: 'Enter a number', 
          points: 1 
        }
      ]
    };

    await page.route(`**/api/lessons/**`, async route => {
      // Apply answer shuffling to the mock data
      const lessonWithShuffledAnswers = {
        ...mockLesson,
        questions: mockLesson.questions.map(q => 
          applyAnswerShuffling(q, mockLesson.randomizationSeed)
        )
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          lesson: lessonWithShuffledAnswers
        })
      });
    });

    await page.goto(`http://localhost:3000/lesson/${mockLesson.id}`);
    await page.waitForSelector('[data-testid="lesson-title"]');

    // Check ABCD question answers are shuffled
    await page.click('[data-testid="question-nav-0"]');
    const abcdChoices = await page.locator('[data-testid^="choice-0-"]').allTextContents();
    
    // Original order was ['Option A', 'Option B', 'Option C', 'Option D']
    // Should be shuffled
    expect(abcdChoices.join(',')).not.toBe('Option A,Option B,Option C,Option D');
    expect(abcdChoices).toHaveLength(4);

    // Check TRUEFALSE question choices are shuffled
    await page.click('[data-testid="question-nav-1"]');
    const trueFalseChoices = await page.locator('[data-testid="truefalse-container-1"] .flex-1').allTextContents();
    
    // Should have shuffled order
    expect(trueFalseChoices).toHaveLength(4);
    expect(trueFalseChoices.join(',')).not.toBe('Statement 1,Statement 2,Statement 3,Statement 4');

    // Check NUMBER question (no shuffling applicable)
    await page.click('[data-testid="question-nav-2"]');
    await expect(page.locator('[data-testid="number-input-2"]')).toBeVisible();
  });

  test('should produce consistent shuffling with the same randomization seed', async ({ page }) => {
    const mockLesson = {
      id: 'test-seed-consistency',
      title: 'Test Seed Consistency',
      subject: 'Physics',
      grade: '12',
      shuffleQuestions: true,
      shuffleAnswers: true,
      randomizationSeed: 99999,
      questions: [
        { id: 'q1', type: 'ABCD', question: 'Q1', options: ['A1', 'B1', 'C1', 'D1'], points: 1 },
        { id: 'q2', type: 'ABCD', question: 'Q2', options: ['A2', 'B2', 'C2', 'D2'], points: 1 },
        { id: 'q3', type: 'TRUEFALSE', question: 'Q3', options: ['T1', 'F1'], points: 1 }
      ]
    };

    // First load
    await page.route(`**/api/lessons/**`, async route => {
      const shuffledLesson = {
        ...mockLesson,
        questions: applyQuestionShuffling(mockLesson.questions, mockLesson.randomizationSeed)
          .map(q => applyAnswerShuffling(q, mockLesson.randomizationSeed))
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, lesson: shuffledLesson })
      });
    });

    await page.goto(`http://localhost:3000/lesson/${mockLesson.id}`);
    await page.waitForSelector('[data-testid="lesson-title"]');

    // Record the order from first load
    const firstLoadOrder = [];
    for (let i = 0; i < 3; i++) {
      await page.click(`[data-testid="question-nav-${i}"]`);
      const questionText = await page.locator('[data-testid="question-content"]').textContent();
      firstLoadOrder.push(questionText);
    }

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="lesson-title"]');

    // Record the order from second load
    const secondLoadOrder = [];
    for (let i = 0; i < 3; i++) {
      await page.click(`[data-testid="question-nav-${i}"]`);
      const questionText = await page.locator('[data-testid="question-content"]').textContent();
      secondLoadOrder.push(questionText);
    }

    // Orders should be identical with same seed
    expect(secondLoadOrder).toEqual(firstLoadOrder);
  });

  test('should display countdown timer when time limit is enabled', async ({ page }) => {
    const mockLesson = {
      id: 'test-timer',
      title: 'Test Timer Lesson',
      subject: 'Physics',
      grade: '12',
      timeLimitEnabled: true,
      timeLimitHours: 1,
      timeLimitMinutes: 30,
      timeLimitSeconds: 45,
      showCountdown: true,
      autoSubmit: true,
      questions: [
        { id: 'q1', type: 'ABCD', question: 'Q1', options: ['A', 'B', 'C', 'D'], points: 1 }
      ]
    };

    await page.route(`**/api/lessons/**`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, lesson: mockLesson })
      });
    });

    await page.goto(`http://localhost:3000/lesson/${mockLesson.id}`);
    await page.waitForSelector('[data-testid="lesson-title"]');

    // Check for countdown timer
    const timerDisplay = page.locator('[data-testid="countdown-timer"]');
    await expect(timerDisplay).toBeVisible();

    // Calculate expected initial time (1:30:45 = 5445 seconds)
    const totalSeconds = (1 * 3600) + (30 * 60) + 45;
    const expectedTime = `${Math.floor(totalSeconds / 3600)}:${Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`;

    // Check initial timer display
    const initialTime = await timerDisplay.textContent();
    expect(initialTime).toBe(expectedTime);

    // Wait a bit and check timer counts down
    await page.waitForTimeout(2000);
    const newTime = await timerDisplay.textContent();
    expect(newTime).not.toBe(initialTime);
  });

  test('should auto-submit when timer expires', async ({ page }) => {
    const mockLesson = {
      id: 'test-auto-submit',
      title: 'Test Auto Submit',
      subject: 'Physics',
      grade: '12',
      timeLimitEnabled: true,
      timeLimitHours: 0,
      timeLimitMinutes: 0,
      timeLimitSeconds: 3, // 3 seconds for quick test
      autoSubmit: true,
      questions: [
        { id: 'q1', type: 'ABCD', question: 'Q1', options: ['A', 'B', 'C', 'D'], points: 1 }
      ]
    };

    await page.route(`**/api/lessons/**`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, lesson: mockLesson })
      });
    });

    // Intercept submit API call
    let submitCalled = false;
    await page.route('**/api/results', async route => {
      submitCalled = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, resultId: 'test-result-123' })
      });
    });

    await page.goto(`http://localhost:3000/lesson/${mockLesson.id}`);
    await page.waitForSelector('[data-testid="lesson-title"]');

    // Wait for timer to expire (3 seconds + buffer)
    await page.waitForTimeout(4000);

    // Check that submit was called
    expect(submitCalled).toBe(true);

    // Should redirect to results page
    await page.waitForURL(/\/results\/test-result-123$/);
  });

  test('should handle complex shuffling scenario', async ({ page }) => {
    // Test with many questions to ensure shuffling works correctly
    const mockLesson = {
      id: 'test-complex-shuffle',
      title: 'Complex Shuffling Test',
      subject: 'Physics',
      grade: '12',
      shuffleQuestions: true,
      shuffleAnswers: true,
      randomizationSeed: 54321,
      questions: [
        // 5 ABCD questions
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `abcd-${i + 1}`,
          type: 'ABCD',
          question: `ABCD Question ${i + 1}`,
          options: [`A${i + 1}`, `B${i + 1}`, `C${i + 1}`, `D${i + 1}`],
          points: 1
        })),
        // 3 TRUEFALSE questions
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `tf-${i + 1}`,
          type: 'TRUEFALSE',
          question: `True/False Question ${i + 1}`,
          options: ['True', 'False'],
          points: 1
        })),
        // 2 NUMBER questions
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `num-${i + 1}`,
          type: 'NUMBER',
          question: `Number Question ${i + 1}`,
          points: 1
        }))
      ]
    };

    await page.route(`**/api/lessons/**`, async route => {
      const shuffledLesson = {
        ...mockLesson,
        questions: applyQuestionShuffling(mockLesson.questions, mockLesson.randomizationSeed)
          .map(q => applyAnswerShuffling(q, mockLesson.randomizationSeed))
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, lesson: shuffledLesson })
      });
    });

    await page.goto(`http://localhost:3000/lesson/${mockLesson.id}`);
    await page.waitForSelector('[data-testid="lesson-title"]');

    // Verify all questions are present
    const questionNavButtons = page.locator('[data-testid^="question-nav-"]');
    expect(await questionNavButtons.count()).toBe(10);

    // Collect question types in display order
    const displayOrder = [];
    for (let i = 0; i < 10; i++) {
      await page.click(`[data-testid="question-nav-${i}"]`);
      const questionType = await page.locator(`[data-testid="question-type-${i}"]`).getAttribute('data-type');
      displayOrder.push(questionType);
    }

    // Verify type grouping: 5 ABCD, then 3 TRUEFALSE, then 2 NUMBER
    expect(displayOrder.slice(0, 5).every(t => t === 'ABCD')).toBe(true);
    expect(displayOrder.slice(5, 8).every(t => t === 'TRUEFALSE')).toBe(true);
    expect(displayOrder.slice(8, 10).every(t => t === 'NUMBER')).toBe(true);
  });
});