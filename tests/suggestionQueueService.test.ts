/**
 * SuggestionQueueService Tests
 *
 * Run with: npx tsx tests/suggestionQueueService.test.ts
 */

// Mock dependencies
class MockGraphStorageManager {
  private emails = new Map<string, any>();
  private clusters = new Map<string, any>();
  private suggestionQueue: any[] = [];

  async loadGraph() {
    return {
      emails: this.emails,
      topicClusters: this.clusters,
      connections: new Map(),
      threadBranches: new Map(),
      emailByConversation: new Map(),
      emailByTopic: new Map(),
      emailBySender: new Map(),
      emailByDateRange: new Map(),
      lastUpdated: Date.now(),
      version: 1,
      userId: 'test-user',
    };
  }

  async saveGraph(graph: any) {
    this.emails = graph.emails;
    this.clusters = graph.topicClusters;
  }

  async getTopicCluster(clusterId: string) {
    return this.clusters.get(clusterId) || null;
  }

  async getEmailsInCluster(clusterId: string) {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return [];
    return cluster.emailIds.map((id: string) => this.emails.get(id)).filter(Boolean);
  }

  async getUnclusteredEmails() {
    const clusteredIds = new Set<string>();
    for (const cluster of this.clusters.values()) {
      for (const id of cluster.emailIds) {
        clusteredIds.add(id);
      }
    }
    return Array.from(this.emails.values()).filter((e: any) => !clusteredIds.has(e.id));
  }

  async getEmail(emailId: string) {
    return this.emails.get(emailId) || null;
  }

  async getEmails(emailIds: string[]) {
    return emailIds.map(id => this.emails.get(id)).filter(Boolean);
  }

  async saveTopicCluster(cluster: any) {
    this.clusters.set(cluster.id, cluster);
  }

  async deleteTopicCluster(clusterId: string) {
    this.clusters.delete(clusterId);
  }

  async loadSuggestionQueue() {
    return this.suggestionQueue;
  }

  async saveSuggestionQueue(queue: any[]) {
    this.suggestionQueue = queue;
  }

  async saveBranchingHistory(record: any) {
    // No-op for tests
  }

  setCluster(cluster: any) {
    this.clusters.set(cluster.id, cluster);
  }

  setEmail(email: any) {
    this.emails.set(email.id, email);
  }

  getClusters() {
    return Array.from(this.clusters.values());
  }
}

// Mock SemanticProfileManager
class MockSemanticProfileManager {
  private profiles = new Map<string, any>();

  setProfile(clusterId: string, profile: any) {
    this.profiles.set(clusterId, profile);
  }

  async getProfile(clusterId: string) {
    return this.profiles.get(clusterId) || null;
  }

  async updateProfile(clusterId: string, emails: any[]) {
    const existing = this.profiles.get(clusterId);
    if (existing) {
      this.profiles.set(clusterId, {
        ...existing,
        emailCount: existing.emailCount + emails.length,
        lastUpdated: Date.now(),
      });
    }
    return this.profiles.get(clusterId);
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
    console.log('=== SuggestionQueueService Tests ===\n');

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

// Import the actual implementation
import { SuggestionQueueService } from '../prototype/services/graph/suggestionQueueService';

// Test 5: Orphan Similarity Calculation
runner.test('Orphan similarity calculation with matching terms', async () => {
  const mockStorage = new MockGraphStorageManager();
  const mockProfileManager = new MockSemanticProfileManager();

  const cluster = {
    id: 'test-cluster',
    name: 'Project Discussion',
    emailIds: ['email1'],
  };

  const orphan = {
    id: 'orphan1',
    subject: 'Project Update',
    keywords: ['project', 'update'],
    topics: ['project'],
    embedding: [1, 2, 3],
  };

  const profile = {
    clusterId: 'test-cluster',
    embeddingCentroid: [1, 2, 3],
    keyTerms: new Map([['project', 0.9], ['discussion', 0.7]]),
    emailCount: 1,
    lastUpdated: Date.now(),
    version: 1,
  };

  mockStorage.setCluster(cluster);
  mockStorage.setEmail(orphan);
  mockProfileManager.setProfile('test-cluster', profile);

  const service = new SuggestionQueueService('user1', mockStorage, mockProfileManager, {
    queueThreshold: 0.3,
  });

  // Access private method via prototype for testing
  const calculateSimilarity = (service as any).calculateOrphanSimilarity.bind(service);
  const score = await calculateSimilarity(orphan, profile);

  if (score < 0.5) {
    throw new Error(`Expected similarity >= 0.5, got ${score}`);
  }

  if (score > 1.0) {
    throw new Error(`Expected similarity <= 1.0, got ${score}`);
  }
});

// Test 6: Thread Merge Similarity
runner.test('Thread merge similarity with similar centroids', async () => {
  const mockStorage = new MockGraphStorageManager();
  const mockProfileManager = new MockSemanticProfileManager();

  const profile1 = {
    clusterId: 'cluster1',
    embeddingCentroid: [1, 2, 3],
    keyTerms: new Map([['project', 0.9]]),
    emailCount: 3,
    lastUpdated: Date.now(),
    version: 1,
  };

  const profile2 = {
    clusterId: 'cluster2',
    embeddingCentroid: [1.1, 2.1, 3.1],
    keyTerms: new Map([['project', 0.85]]),
    emailCount: 2,
    lastUpdated: Date.now(),
    version: 1,
  };

  mockProfileManager.setProfile('cluster1', profile1);
  mockProfileManager.setProfile('cluster2', profile2);

  const service = new SuggestionQueueService('user1', mockStorage, mockProfileManager);

  // Access private method via prototype for testing
  const calculateSimilarity = (service as any).calculateClusterSimilarity.bind(service);
  const score = calculateSimilarity(profile1, profile2);

  if (score < 0.95) {
    throw new Error(`Expected similarity >= 0.95 for similar centroids, got ${score}`);
  }
});

// Test 7: Queue Mode Processing
runner.test('Queue mode processes suggestions correctly', async () => {
  const mockStorage = new MockGraphStorageManager();
  const mockProfileManager = new MockSemanticProfileManager();

  const service = new SuggestionQueueService('user1', mockStorage, mockProfileManager, {
    autoBranchEnabled: false,
    autoBranchThreshold: 0.7,
    queueThreshold: 0.3,
  });

  const suggestions = [
    { id: 's1', matchScore: 0.8 },
    { id: 's2', matchScore: 0.5 },
    { id: 's3', matchScore: 0.2 }, // Below threshold, will be rejected
  ];

  const result = await service.processSuggestions(suggestions);

  if (result.autoExecuted.length !== 0) {
    throw new Error(`Expected 0 auto-executed, got ${result.autoExecuted.length}`);
  }

  // Only suggestions with score >= 0.3 should be queued
  if (result.queued.length !== 2) {
    throw new Error(`Expected 2 queued (scores 0.8 and 0.5), got ${result.queued.length}`);
  }

  if (result.rejected.length !== 1) {
    throw new Error(`Expected 1 rejected (score 0.2), got ${result.rejected.length}`);
  }
});

// Test 8: Auto Mode Processing
runner.test('Auto mode auto-executes high confidence suggestions', async () => {
  const mockStorage = new MockGraphStorageManager();
  const mockProfileManager = new MockSemanticProfileManager();

  const cluster = {
    id: 'test-cluster',
    name: 'Test',
    description: 'Test cluster',
    emailIds: [],
    centroidEmbedding: [],
    subjectVariations: [],
    firstEmailDate: new Date().toISOString(),
    lastEmailDate: new Date().toISOString(),
    confidence: 0.8,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  mockStorage.setCluster(cluster);

  const service = new SuggestionQueueService('user1', mockStorage, mockProfileManager, {
    autoBranchEnabled: true,
    autoBranchThreshold: 0.7,
    queueThreshold: 0.3,
  });

  await service.initialize();

  const suggestions = [
    {
      id: 's1',
      targetClusterId: 'test-cluster',
      type: 'orphan_branch',
      sourceEmailId: 'orphan1',
      matchScore: 0.8,
      reason: 'High similarity',
      queuedAt: Date.now(),
      status: 'pending' as const,
    },
    {
      id: 's2',
      targetClusterId: 'test-cluster',
      type: 'orphan_branch',
      sourceEmailId: 'orphan2',
      matchScore: 0.5,
      reason: 'Medium similarity',
      queuedAt: Date.now(),
      status: 'pending' as const,
    },
    {
      id: 's3',
      targetClusterId: 'test-cluster',
      type: 'orphan_branch',
      sourceEmailId: 'orphan3',
      matchScore: 0.2,
      reason: 'Low similarity',
      queuedAt: Date.now(),
      status: 'pending' as const,
    },
  ];

  // Mock executeSuggestion to avoid actual operations
  (service as any).executeSuggestion = async () => {};

  const result = await service.processSuggestions(suggestions);

  // s1 (0.8 >= 0.7) should be auto-executed
  // s2 (0.5 < 0.7 but >= 0.3) should be queued
  // s3 (0.2 < 0.3) should be rejected

  if (result.autoExecuted.length !== 1) {
    throw new Error(`Expected 1 auto-executed, got ${result.autoExecuted.length}`);
  }

  if (result.queued.length !== 1) {
    throw new Error(`Expected 1 queued, got ${result.queued.length}`);
  }

  if (result.rejected.length !== 1) {
    throw new Error(`Expected 1 rejected, got ${result.rejected.length}`);
  }
});

// Test 9: Branch Orphan
runner.test('Branch orphan adds email to cluster', async () => {
  const mockStorage = new MockGraphStorageManager();
  const mockProfileManager = new MockSemanticProfileManager();

  const cluster = {
    id: 'test-cluster',
    name: 'Test Cluster',
    description: 'Test cluster for branching',
    emailIds: ['email1', 'email2'],
    centroidEmbedding: [2, 3, 4],
    subjectVariations: ['Subject 1'],
    firstEmailDate: '2024-01-01',
    lastEmailDate: '2024-01-02',
    confidence: 0.8,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const orphan = {
    id: 'orphan1',
    subject: 'Related Subject',
    date: '2024-01-03',
    from: 'user@example.com',
    embedding: [3, 4, 5],
  };

  mockStorage.setCluster(cluster);
  mockStorage.setEmail(orphan);
  mockProfileManager.setProfile('test-cluster', {
    clusterId: 'test-cluster',
    embeddingCentroid: [2, 3, 4],
    keyTerms: new Map(),
    emailCount: 2,
    lastUpdated: Date.now(),
    version: 1,
  });

  const service = new SuggestionQueueService('user1', mockStorage, mockProfileManager);
  await service.initialize();

  const suggestion = {
    id: 's1',
    targetClusterId: 'test-cluster',
    type: 'orphan_branch' as const,
    sourceEmailId: 'orphan1',
    matchScore: 0.8,
    reason: 'Test',
    queuedAt: Date.now(),
    status: 'pending' as const,
  };

  // Queue the suggestion first
  await service.queueSuggestion(suggestion);

  // Then accept it
  await service.acceptSuggestion(suggestion.id);

  const updatedCluster = await mockStorage.getTopicCluster('test-cluster');

  if (!updatedCluster.emailIds.includes('orphan1')) {
    throw new Error('Orphan not added to cluster');
  }

  if (updatedCluster.emailIds.length !== 3) {
    throw new Error(`Expected 3 emails, got ${updatedCluster.emailIds.length}`);
  }
});

// Test 10: Merge Clusters
runner.test('Merge clusters combines email IDs', async () => {
  const mockStorage = new MockGraphStorageManager();
  const mockProfileManager = new MockSemanticProfileManager();

  const targetCluster = {
    id: 'target-cluster',
    name: 'Target',
    description: 'Target cluster',
    emailIds: ['email1', 'email2'],
    subjectVariations: ['Subject A'],
    centroidEmbedding: [1, 2, 3],
    firstEmailDate: '2024-01-01',
    lastEmailDate: '2024-01-02',
    confidence: 0.8,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const sourceCluster = {
    id: 'source-cluster',
    name: 'Source',
    description: 'Source cluster',
    emailIds: ['email3', 'email4'],
    subjectVariations: ['Subject B'],
    centroidEmbedding: [1, 2, 3],
    firstEmailDate: '2024-01-01',
    lastEmailDate: '2024-01-03',
    confidence: 0.7,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  mockStorage.setCluster(targetCluster);
  mockStorage.setCluster(sourceCluster);

  for (const id of [...targetCluster.emailIds, ...sourceCluster.emailIds]) {
    mockStorage.setEmail({ id, subject: `Email ${id}` });
  }

  const service = new SuggestionQueueService('user1', mockStorage, mockProfileManager);
  await service.initialize();

  const suggestion = {
    id: 's1',
    targetClusterId: 'target-cluster',
    type: 'thread_merge' as const,
    sourceClusterId: 'source-cluster',
    matchScore: 0.8,
    reason: 'Test',
    queuedAt: Date.now(),
    status: 'pending' as const,
  };

  // Queue the suggestion first
  await service.queueSuggestion(suggestion);

  // Then accept it
  await service.acceptSuggestion(suggestion.id);

  const updatedTarget = await mockStorage.getTopicCluster('target-cluster');
  const deletedSource = await mockStorage.getTopicCluster('source-cluster');

  if (updatedTarget.emailIds.length !== 4) {
    throw new Error(`Expected 4 emails in target, got ${updatedTarget.emailIds.length}`);
  }

  if (deletedSource !== null) {
    throw new Error('Source cluster should be deleted');
  }
});

// Run tests
runner.run();
