/**
 * SemanticProfileManager Tests
 *
 * Run with: npx tsx tests/semanticProfileManager.test.ts
 */

// Import the actual implementation (GREEN phase will make this work)
import { SemanticProfileManager } from '../prototype/services/graph/semanticProfileManager';

// Mock dependencies for testing
class MockGraphStorageManager {
  private emails = new Map<string, any>();
  private clusters = new Map<string, any>();

  async getTopicCluster(clusterId: string) {
    return this.clusters.get(clusterId) || null;
  }

  async getEmailsInCluster(clusterId: string) {
    const cluster = this.clusters.get(clusterId);
    if (!cluster || !cluster.emailIds) return [];
    return cluster.emailIds.map((id: string) => this.emails.get(id)).filter(Boolean);
  }

  setCluster(cluster: any) {
    this.clusters.set(cluster.id, cluster);
  }

  setEmail(email: any) {
    this.emails.set(email.id, email);
  }

  async saveTopicCluster(cluster: any) {
    this.clusters.set(cluster.id, cluster);
  }
}

// Simple test runner
class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> | void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void> | void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('=== SemanticProfileManager Tests ===\n');

    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✅ PASS: ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   Error: ${error}`);
        this.failed++;
      }
    }

    console.log(`\n=== Results: ${this.passed} passed, ${this.failed} failed ===`);
    process.exit(this.failed > 0 ? 1 : 0);
  }
}

const runner = new TestRunner();

// Test 1: Centroid Calculation
runner.test('Centroid calculation from email embeddings', async () => {
  const mockStorage = new MockGraphStorageManager();
  mockStorage.setCluster({
    id: 'test-cluster',
    emailIds: ['email1', 'email2'],
    centroidEmbedding: [],
  });

  const email1 = {
    id: 'email1',
    embedding: [1, 2, 3],
  };
  const email2 = {
    id: 'email2',
    embedding: [3, 4, 5],
  };

  mockStorage.setEmail(email1);
  mockStorage.setEmail(email2);

  const manager = new SemanticProfileManager(mockStorage);
  const profile = await manager.getProfile('test-cluster');

  // Expected: [2, 3, 4]
  const expected = [2, 3, 4];
  for (let i = 0; i < expected.length; i++) {
    const diff = Math.abs(profile!.embeddingCentroid[i] - expected[i]);
    if (diff > 0.001) {
      throw new Error(`Centroid[${i}] = ${profile!.embeddingCentroid[i]}, expected ${expected[i]}, diff ${diff}`);
    }
  }
});

// Test 2: Incremental Centroid Update
runner.test('Incremental centroid update with EMA', async () => {
  const mockStorage = new MockGraphStorageManager();
  const cluster = {
    id: 'test-cluster',
    emailIds: ['email1', 'email2'],
    centroidEmbedding: [2, 3, 4],
  };
  mockStorage.setCluster(cluster);

  const newEmail = {
    id: 'new-email',
    embedding: [5, 6, 7],
  };

  mockStorage.setEmail(newEmail);

  const manager = new SemanticProfileManager(mockStorage, { centroidUpdateWeight: 0.1 });
  const updated = await manager.updateProfile('test-cluster', [newEmail]);

  // EMA: new = (1 - 0.1) * [2,3,4] + 0.1 * [5,6,7] = [2.3, 3.3, 4.3]
  const expected = [2.3, 3.3, 4.3];
  for (let i = 0; i < expected.length; i++) {
    const diff = Math.abs(updated!.embeddingCentroid[i] - expected[i]);
    if (diff > 0.001) {
      throw new Error(`Updated centroid[${i}] = ${updated!.embeddingCentroid[i]}, expected ${expected[i]}, diff ${diff}`);
    }
  }
});

// Test 3: Key Term Extraction
runner.test('Key term extraction from email content', async () => {
  const mockStorage = new MockGraphStorageManager();
  mockStorage.setCluster({
    id: 'test-cluster',
    emailIds: ['email1', 'email2'],
    centroidEmbedding: [],
  });

  const email1 = {
    id: 'email1',
    subject: 'Project Update',
    bodyPreview: 'Discussion about the project timeline',
    keywords: ['project', 'timeline', 'update'],
    topics: ['project', 'management'],
    embedding: [1, 2, 3],
  };

  const email2 = {
    id: 'email2',
    subject: 'Meeting about Project',
    bodyPreview: 'Let discuss project milestones',
    keywords: ['meeting', 'project', 'milestones'],
    topics: ['project'],
    embedding: [1, 2, 3],
  };

  mockStorage.setEmail(email1);
  mockStorage.setEmail(email2);

  const manager = new SemanticProfileManager(mockStorage);
  const profile = await manager.getProfile('test-cluster');

  // Check that "project" is a key term
  const hasProjectTerm = Array.from(profile!.keyTerms.keys()).some(term =>
    term.toLowerCase().includes('project')
  );

  if (!hasProjectTerm) {
    throw new Error('Expected "project" to be a key term');
  }

  // "project" should have high weight (appears in both subjects)
  const projectWeight = profile!.keyTerms.get('project') || profile!.keyTerms.get('Project') || 0;
  if (projectWeight < 0.5) {
    throw new Error(`Expected "project" weight >= 0.5, got ${projectWeight}`);
  }
});

// Test 4: Profile Cache
runner.test('Profile cache with TTL expiration', async () => {
  const mockStorage = new MockGraphStorageManager();
  mockStorage.setCluster({
    id: 'test-cluster',
    emailIds: ['email1'],
    centroidEmbedding: [1, 2, 3],
  });

  mockStorage.setEmail({
    id: 'email1',
    embedding: [1, 2, 3],
  });

  const manager = new SemanticProfileManager(mockStorage, { cacheTTL: 100 }); // 100ms TTL

  // First call - builds profile
  const profile1 = await manager.getProfile('test-cluster');
  const timestamp1 = profile1!.lastUpdated;

  // Second call immediately - should use cache
  const profile2 = await manager.getProfile('test-cluster');
  const timestamp2 = profile2!.lastUpdated;

  if (timestamp1 !== timestamp2) {
    throw new Error('Expected cached profile with same timestamp');
  }

  // Wait for TTL to expire
  await new Promise(resolve => setTimeout(resolve, 150));

  // Third call after TTL - should rebuild
  const profile3 = await manager.getProfile('test-cluster');
  const timestamp3 = profile3!.lastUpdated;

  if (timestamp3 <= timestamp2) {
    throw new Error('Expected new profile after TTL expiration');
  }
});

// Run tests
runner.run();
