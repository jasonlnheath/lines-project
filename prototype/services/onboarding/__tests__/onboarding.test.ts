/**
 * Onboarding System Tests
 *
 * Tests for role detection and onboarding agent.
 */

import { RoleDetectorService } from '../roleDetector';
import { OnboardingAgentService } from '../onboardingAgent';
import { UserRole, GraphOrgInfo } from '../types';

// ============================================================================
// Test Helpers
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;
const results: Array<{ passed: boolean; message: string }> = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ passed: true, message: name });
    testsPassed++;
  } catch (e: unknown) {
    results.push({ passed: false, message: `${name}: ${String(e)}` });
    testsFailed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

// ============================================================================
// Role Detector Tests
// ============================================================================

function createMockOrgInfo(
  jobTitle: string,
  department?: string,
  managerTitle?: string,
  directReportCount: number = 0
): GraphOrgInfo {
  return {
    user: {
      id: 'user-1',
      displayName: 'Test User',
      mail: 'user@company.com',
      jobTitle,
      department,
    },
    manager: managerTitle
      ? {
          id: 'manager-1',
          displayName: 'Test Manager',
          mail: 'manager@company.com',
          jobTitle: managerTitle,
        }
      : null,
    directReports: Array(directReportCount)
      .fill(null)
      .map((_, i) => ({
        id: `report-${i}`,
        displayName: `Report ${i}`,
        mail: `report${i}@company.com`,
      })),
  };
}

function testRoleDetection_Sales() {
  const detector = new RoleDetectorService();

  const result = detector.detectRole(createMockOrgInfo('Sales Manager', 'Sales'));

  assert(result.inferredRole === 'sales', 'Should detect sales role');
  assert(result.confidence === 'high', 'Should have high confidence');
}

function testRoleDetection_Engineering() {
  const detector = new RoleDetectorService();

  const result = detector.detectRole(
    createMockOrgInfo('Senior Software Engineer', 'Engineering')
  );

  assert(result.inferredRole === 'engineering', 'Should detect engineering role');
  assert(result.confidence === 'high', 'Should have high confidence');
}

function testRoleDetection_Executive() {
  const detector = new RoleDetectorService();

  const result = detector.detectRole(createMockOrgInfo('Vice President of Sales', 'Sales'));

  assert(result.inferredRole === 'executive', 'VP should be executive');
  assert(result.confidence === 'high', 'Should have high confidence');
}

function testRoleDetection_Purchasing() {
  const detector = new RoleDetectorService();

  const result = detector.detectRole(
    createMockOrgInfo('Procurement Manager', 'Procurement')
  );

  assert(result.inferredRole === 'purchasing', 'Should detect purchasing role');
}

function testRoleDetection_Finance() {
  const detector = new RoleDetectorService();

  const result = detector.detectRole(
    createMockOrgInfo('Financial Analyst', 'Finance')
  );

  assert(result.inferredRole === 'finance', 'Should detect finance role');
}

function testRoleDetection_HR() {
  const detector = new RoleDetectorService();

  const result = detector.detectRole(
    createMockOrgInfo('HR Business Partner', 'Human Resources')
  );

  assert(result.inferredRole === 'hr', 'Should detect HR role');
}

function testRoleDetection_Other() {
  const detector = new RoleDetectorService();

  const result = detector.detectRole(createMockOrgInfo('Mystery Role', 'Unknown Dept'));

  assert(result.inferredRole === 'other', 'Unknown role should be other');
  assert(result.confidence === 'low', 'Should have low confidence');
}

function testExecutiveTitleDetection() {
  const detector = new RoleDetectorService();

  const executiveTitles = [
    'CEO',
    'Chief Executive Officer',
    'CTO',
    'Chief Technology Officer',
    'CFO',
    'Vice President of Sales',
    'VP of Marketing',
    'Owner',
    'Founder',
    'President',
    'Managing Director',
  ];

  for (const title of executiveTitles) {
    assert(
      detector.isExecutiveTitle(title),
      `"${title}" should be detected as executive`
    );
  }

  const nonExecutiveTitles = [
    'Software Engineer',
    'Sales Representative',
    'Project Manager',
    'Vice Principal', // Not VP
  ];

  for (const title of nonExecutiveTitles) {
    assert(
      !detector.isExecutiveTitle(title),
      `"${title}" should NOT be detected as executive`
    );
  }
}

// ============================================================================
// Onboarding Agent Tests
// ============================================================================

function testOnboardingStart() {
  const agent = new OnboardingAgentService();

  const state = agent.startOnboarding('user-1', {
    userId: 'user-1',
    inferredRole: 'sales',
    confidence: 'high',
    signals: { jobTitle: 'Sales Manager', department: 'Sales' },
  });

  assert(state.status === 'in_progress', 'Should be in progress');
  assert(state.questions.length > 0, 'Should have questions');
  assert(state.currentQuestionIndex === 0, 'Should start at first question');
}

function testOnboardingQuestions_Sales() {
  const agent = new OnboardingAgentService();

  const state = agent.startOnboarding('user-2', {
    userId: 'user-2',
    inferredRole: 'sales',
    confidence: 'high',
    signals: {},
  });

  // Sales should ask about customers, prospects, partners, vendors
  const categories = state.questions.map((q) => q.category);

  assert(categories.includes('customers'), 'Should ask about customers');
  assert(categories.includes('prospects'), 'Should ask about prospects');
  assert(categories.includes('vendors'), 'Should ask about vendors');
}

function testOnboardingQuestions_Executive() {
  const agent = new OnboardingAgentService();

  const state = agent.startOnboarding('user-3', {
    userId: 'user-3',
    inferredRole: 'executive',
    confidence: 'high',
    signals: {},
  });

  // Executives should ask about team, board, executives, media
  const categories = state.questions.map((q) => q.category);

  assert(categories.includes('team'), 'Should ask about team');
  assert(categories.includes('board'), 'Should ask about board');
}

function testOnboardingAnswerSubmission() {
  const agent = new OnboardingAgentService();

  agent.startOnboarding('user-4', {
    userId: 'user-4',
    inferredRole: 'sales',
    confidence: 'high',
    signals: {},
  });

  const firstQuestion = agent.getCurrentQuestion('user-4');
  assert(firstQuestion !== null, 'Should have first question');

  const state = agent.submitAnswer('user-4', 'push');

  assert(state.answers.length === 1, 'Should have one answer');
  assert(state.answers[0].selectedPreference === 'push', 'Should record push preference');
}

function testOnboardingCompletion() {
  const agent = new OnboardingAgentService();

  const state = agent.startOnboarding('user-5', {
    userId: 'user-5',
    inferredRole: 'sales',
    confidence: 'high',
    signals: {},
  });

  // Answer all questions
  for (let i = 0; i < state.questions.length; i++) {
    agent.submitAnswer('user-5', 'push');
  }

  const finalState = agent.getOnboardingState('user-5');
  assert(finalState?.status === 'completed', 'Should be completed');
  assert(finalState?.completedAt !== undefined, 'Should have completion time');

  const summary = agent.generateSummary('user-5');
  assert(summary !== null, 'Should have summary');
  assert(summary?.role === 'sales', 'Summary should have role');
}

function testOnboardingSkip() {
  const agent = new OnboardingAgentService();

  agent.startOnboarding('user-6', {
    userId: 'user-6',
    inferredRole: 'other',
    confidence: 'low',
    signals: {},
  });

  const state = agent.skipOnboarding('user-6');

  assert(state.status === 'skipped', 'Should be skipped');
}

function testWelcomeMessage() {
  const agent = new OnboardingAgentService();

  const message = agent.getWelcomeMessage({
    userId: 'user-7',
    inferredRole: 'sales',
    confidence: 'high',
    signals: {},
  });

  assert(message.includes('Sales'), 'Should mention sales role');
  assert(message.includes('push'), 'Should mention push');
  assert(message.includes('pull'), 'Should mention pull');
}

function testPreFilledContacts() {
  const agent = new OnboardingAgentService();

  const state = agent.startOnboarding(
    'user-8',
    {
      userId: 'user-8',
      inferredRole: 'engineering',
      confidence: 'high',
      signals: {},
    },
    [
      {
        email: 'boss@company.com',
        name: 'Big Boss',
        relationship: 'manager',
        suggestedPreference: 'push',
        reason: 'your_manager',
      },
    ]
  );

  assert(state.preFilledContacts.length === 1, 'Should have pre-filled contact');
  assert(
    state.preFilledContacts[0].relationship === 'manager',
    'Should be manager relationship'
  );
}

// ============================================================================
// Run All Tests
// ============================================================================

function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Onboarding System Tests                                 ║');
  console.log('║  Role Detection + Agent Questions                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  console.log('\n=== Role Detection Tests ===');
  test('Test: Role Detection - Sales', testRoleDetection_Sales);
  test('Test: Role Detection - Engineering', testRoleDetection_Engineering);
  test('Test: Role Detection - Executive', testRoleDetection_Executive);
  test('Test: Role Detection - Purchasing', testRoleDetection_Purchasing);
  test('Test: Role Detection - Finance', testRoleDetection_Finance);
  test('Test: Role Detection - HR', testRoleDetection_HR);
  test('Test: Role Detection - Other', testRoleDetection_Other);
  test('Test: Executive Title Detection', testExecutiveTitleDetection);

  console.log('\n=== Onboarding Agent Tests ===');
  test('Test: Onboarding Start', testOnboardingStart);
  test('Test: Onboarding Questions - Sales', testOnboardingQuestions_Sales);
  test('Test: Onboarding Questions - Executive', testOnboardingQuestions_Executive);
  test('Test: Answer Submission', testOnboardingAnswerSubmission);
  test('Test: Onboarding Completion', testOnboardingCompletion);
  test('Test: Onboarding Skip', testOnboardingSkip);
  test('Test: Welcome Message', testWelcomeMessage);
  test('Test: Pre-filled Contacts', testPreFilledContacts);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${testsPassed} passed, ${testsFailed} failed                        ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  results.forEach((r) => {
    console.log(`${r.passed ? '✓' : '✗'} ${r.message}`);
  });

  return testsFailed === 0;
}

// Run if executed directly
if (require.main === module) {
  const success = runAllTests();
  process.exit(success ? 0 : 1);
}

export { runAllTests };
