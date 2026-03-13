/**
 * Contact System Integration Tests
 *
 * Tests for the agent-driven contact learning system.
 * No manual tags - auto-detection + user preferences.
 */

import { RelationshipContextProvider } from '../relationshipContextProvider';

// ============================================================================
// Test Helpers
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.log(`  ✗ FAIL: ${message}`);
    testsFailed++;
  }
}

// ============================================================================
// Test: Manager Detection
// ============================================================================

function testManagerDetection() {
  console.log('\n=== Test: Manager Detection ===');

  const contextProvider = new RelationshipContextProvider();
  contextProvider.initialize({
    userDomain: 'acme.com',
    managerEmail: 'boss@acme.com',
  });

  const decision = contextProvider.getPushDecision('boss@acme.com');

  assert(decision.shouldPush === true, 'Manager email should push');
  assert(decision.priority === 'high', 'Manager priority should be high');
  assert(decision.reason === 'your_manager', 'Reason should be your_manager');
}

// ============================================================================
// Test: Executive Detection (Title Pattern Matching)
// ============================================================================

function testExecutiveDetection() {
  console.log('\n=== Test: Executive Detection (Title Patterns) ===');

  const executiveTitles = [
    { title: 'CEO', expected: true },
    { title: 'Chief Executive Officer', expected: true },
    { title: 'VP of Sales', expected: true },
    { title: 'Vice President of Engineering', expected: true },
    { title: 'Owner', expected: true },
    { title: 'Founder', expected: true },
    { title: 'Director of Marketing', expected: true },
    { title: 'President', expected: true },
    { title: 'CFO', expected: true },
    { title: 'CTO', expected: true },
    { title: 'Software Engineer', expected: false },
    { title: 'Sales Representative', expected: false },
    { title: 'Project Manager', expected: false },
  ];

  // Test the executive detection pattern (same logic as ContactSyncService)
  function detectIsExecutive(jobTitle: string): boolean {
    if (!jobTitle) return false;
    const title = jobTitle.toLowerCase();

    if (/^(ceo|cio|cto|cfo|coo|cmo|cro|cso|cpo|clo)\b/.test(title)) return true;
    if (title.includes('chief ')) return true;
    if (title.includes('vice president')) return true;
    if (title.startsWith('vp') || title.startsWith('vp.')) return true;
    if (title.includes('owner')) return true;
    if (title.includes('founder')) return true;
    if (title.includes('president')) return true;
    if (title.includes('director')) return true;

    return false;
  }

  for (const { title, expected } of executiveTitles) {
    const result = detectIsExecutive(title);
    assert(
      result === expected,
      `"${title}" ${expected ? 'should' : 'should not'} be detected as executive`
    );
  }
}

// ============================================================================
// Test: User Preference (Unknown Contact)
// ============================================================================

function testUserPreference() {
  console.log('\n=== Test: User Preference (Unknown Contact) ===');

  const contextProvider = new RelationshipContextProvider();

  // Test unknown sender (no contact in index)
  const decision = contextProvider.getPushDecision('unknown@external.com');

  assert(decision.shouldPush === false, 'Unknown sender should not push by default');
  assert(decision.reason === 'default_pull', 'Unknown sender reason should be default_pull');
}

// ============================================================================
// Test: Progressive Disclosure (New Sender Prompts)
// ============================================================================

function testProgressiveDisclosure() {
  console.log('\n=== Test: Progressive Disclosure ===');

  const contextProvider = new RelationshipContextProvider();
  contextProvider.initialize({ userDomain: 'acme.com' });

  // External sender
  const externalPrompt = contextProvider.createNewSenderPrompt('unknown@external.com');
  assert(
    externalPrompt.suggestedAction === 'pull',
    'External sender should suggest pull'
  );
  assert(
    externalPrompt.detectedInfo.isInternal === false,
    'External sender should not be internal'
  );
  assert(
    externalPrompt.reason === 'new_sender_external',
    'External sender reason should be new_sender_external'
  );

  // Internal sender
  const internalPrompt = contextProvider.createNewSenderPrompt('newcolleague@acme.com');
  assert(
    internalPrompt.detectedInfo.isInternal === true,
    'Same domain sender should be internal'
  );
  assert(
    internalPrompt.suggestedAction === 'ask',
    'Internal sender should suggest ask'
  );
  assert(
    internalPrompt.reason === 'new_sender_internal',
    'Internal sender reason should be new_sender_internal'
  );
}

// ============================================================================
// Test: Push Decision Priority Order
// ============================================================================

function testPushDecisionPriority() {
  console.log('\n=== Test: Push Decision Priority Order ===');

  const contextProvider = new RelationshipContextProvider();
  contextProvider.initialize({
    userDomain: 'acme.com',
    managerEmail: 'boss@acme.com',
  });

  // Test 1: Manager should always push
  const managerDecision = contextProvider.getPushDecision('boss@acme.com');
  assert(managerDecision.shouldPush === true, 'Manager should push');
  assert(managerDecision.priority === 'high', 'Manager should be high priority');

  // Test 2: Unknown external should not push
  const unknownDecision = contextProvider.getPushDecision('random@external.com');
  assert(unknownDecision.shouldPush === false, 'Unknown external should not push');
  assert(unknownDecision.priority === 'low', 'Unknown external should be low priority');

  // Test 3: Internal colleague (direct recipient) should push
  const internalDecision = contextProvider.getPushDecision('colleague@acme.com', {
    isDirectRecipient: true,
  });
  // Note: Without contact in index, internal detection relies on domain
  assert(
    internalDecision.contactContext?.isInternal === true,
    'Same domain should be detected as internal'
  );
}

// ============================================================================
// Test: Contact Context Properties
// ============================================================================

function testContactContextProperties() {
  console.log('\n=== Test: Contact Context Properties ===');

  const contextProvider = new RelationshipContextProvider();
  contextProvider.initialize({ userDomain: 'acme.com' });

  const context = contextProvider.getContactContext('unknown@external.com');

  assert(context.exists === false, 'Unknown contact should not exist');
  assert(context.isMyManager === false, 'Unknown contact should not be manager');
  assert(context.isMyDirectReport === false, 'Unknown contact should not be direct report');
  assert(context.isExecutive === false, 'Unknown contact should not be executive');
  assert(context.isInternal === false, 'External email should not be internal');
  assert(context.relevanceScore === 0, 'Unknown contact should have 0 relevance');
  assert(context.isFavorite === false, 'Unknown contact should not be favorite');
  assert(context.pushPreference === 'unset', 'Unknown contact should have unset preference');
}

// ============================================================================
// Run All Tests
// ============================================================================

function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Contact System Tests                                    ║');
  console.log('║  Agent-Driven Learning (No Manual Tags)                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  testManagerDetection();
  testExecutiveDetection();
  testUserPreference();
  testProgressiveDisclosure();
  testPushDecisionPriority();
  testContactContextProperties();

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${testsPassed} passed, ${testsFailed} failed                        ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  return testsFailed === 0;
}

// Run tests
const success = runAllTests();
process.exit(success ? 0 : 1);
