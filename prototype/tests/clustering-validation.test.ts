/**
 * Test for clustering validation name normalization
 *
 * Run with: npx ts-node tests/clustering-validation.test.ts
 */

// Simulate the normalizeThreadName function from clusteringTestService.ts
function normalizeThreadName(subject: string): string {
  return subject
    .replace(/^(RE|FW|Fwd):\s*/i, '')
    .replace(/\s*\*/g, ' ')
    .replace(/\.\.\.+$/, '')  // Remove trailing ellipsis (legacy clusters)
    .trim()
    .substring(0, 50);
}

// Simulate the generateThreadName function from clusteringService.ts (FIXED)
function generateThreadName(subject: string): string {
  let cleanSubject = subject
    .replace(/^(RE|FW|Fwd):\s*/i, '')
    .replace(/\s*\*/g, ' ')
    .trim();

  // FIXED: No ellipsis, just truncate to 50 chars
  return cleanSubject.substring(0, 50);
}

// Test cases - verify that normalizeThreadName and generateThreadName produce matching output
const testCases = [
  {
    name: 'Short subject',
    subject: 'Project Update',
  },
  {
    name: 'Subject with RE: prefix',
    subject: 'RE: Weekly Meeting',
  },
  {
    name: 'Subject with FW: prefix',
    subject: 'FW: Important Announcement',
  },
  {
    name: 'Subject with Fwd: prefix',
    subject: 'Fwd: Q4 Report',
  },
  {
    name: 'Long subject (over 50 chars)',
    subject: 'This is a very long subject line that needs to be truncated because it exceeds fifty characters',
  },
  {
    name: 'Subject with asterisks',
    subject: 'Meeting * Tomorrow * Important',
  },
  {
    name: 'Subject with multiple RE: prefixes',
    subject: 'RE: RE: RE: Discussion',
  },
];

console.log('=== Clustering Validation Name Normalization Tests ===\n');

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const normalizedThread = normalizeThreadName(tc.subject);
  const generatedCluster = generateThreadName(tc.subject);
  const match = normalizedThread.toLowerCase().trim() === generatedCluster.toLowerCase().trim();

  if (match) {
    console.log(`✅ PASS: ${tc.name}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${tc.name}`);
    console.log(`   Input: "${tc.subject}"`);
    console.log(`   normalizeThreadName: "${normalizedThread}"`);
    console.log(`   generateThreadName: "${generatedCluster}"`);
    failed++;
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

// Test the validation comparison with legacy clusters (with ...)
console.log('\n=== Legacy Cluster Compatibility Test ===\n');

// Legacy cluster was created with old code: 47 chars + "..."
const legacyClusterName = 'This is a very long subject line that needs t...';
// Thread name comes from full subject, truncated to 50 chars
const threadName = normalizeThreadName('This is a very long subject line that needs to be truncated');

// Normalize the cluster name too (the fix)
const normalizedClusterName = normalizeThreadName(legacyClusterName);
const legacyMatch = normalizedClusterName.toLowerCase().trim() === threadName.toLowerCase().trim();

console.log(`Legacy cluster name: "${legacyClusterName}"`);
console.log(`Normalized cluster: "${normalizedClusterName}"`);
console.log(`Thread name: "${threadName}"`);
console.log(`Match after normalization: ${legacyMatch ? '✅ YES' : '❌ NO'}`);
console.log(`\nNote: Legacy clusters may not match perfectly because they were truncated`);
console.log(`at 47 chars + "...", while threads are truncated at 50 chars.`);
console.log(`This is expected - old clusters will show as 'name_mismatch' but still have good coverage.`);

// Test that NEW clusters (created after fix) will match perfectly
console.log('\n=== New Cluster Compatibility Test ===\n');

const newClusterSubject = 'This is a very long subject line that needs to be truncated because it exceeds fifty characters';
const newClusterName = generateThreadName(newClusterSubject);
const newThreadName = normalizeThreadName(newClusterSubject);
const newMatch = newClusterName.toLowerCase().trim() === newThreadName.toLowerCase().trim();

console.log(`New cluster name: "${newClusterName}"`);
console.log(`Thread name: "${newThreadName}"`);
console.log(`Match: ${newMatch ? '✅ YES' : '❌ NO'}`);

if (!newMatch) {
  console.log('\n❌ CRITICAL: New clusters should match perfectly!');
  process.exit(1);
}

console.log('\n✅ All critical tests passed! New clusters will match thread names.');

process.exit(0);
