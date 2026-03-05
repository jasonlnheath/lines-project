/**
 * Graph Storage Manager
 *
 * Abstraction layer for graph storage operations.
 * Provides a clean interface that can be backed by different storage implementations
 * (filesystem, database, etc.) without changing the calling code.
 *
 * This design follows the persona storage pattern used elsewhere in the application.
 */

import { FilesystemGraphStore } from './filesystemStore';
import {
  EmailNode,
  TopicCluster,
  UserGraphPreferences,
  EmailKnowledgeGraph,
} from '../types';

/**
 * Storage backend type
 * Future: Add DatabaseStore, IndexedDBStore, etc.
 */
type StorageBackend = FilesystemGraphStore;

/**
 * Graph Storage Manager
 * Provides a unified interface for all graph storage operations
 */
export class GraphStorageManager {
  private backend: StorageBackend;
  private userId: string;

  constructor(userId: string, backend?: StorageBackend) {
    this.userId = userId;
    this.backend = backend || new FilesystemGraphStore();
  }

  /**
   * Load complete graph for current user
   */
  async loadGraph(): Promise<EmailKnowledgeGraph | null> {
    return this.backend.loadGraph(this.userId);
  }

  /**
   * Save complete graph for current user
   */
  async saveGraph(graph: EmailKnowledgeGraph): Promise<void> {
    return this.backend.saveGraph(this.userId, graph);
  }

  /**
   * Add or update a single email in the graph
   */
  async addEmail(email: EmailNode): Promise<void> {
    return this.backend.updateEmail(this.userId, email);
  }

  /**
   * Get a specific email by ID
   */
  async getEmail(emailId: string): Promise<EmailNode | null> {
    const graph = await this.loadGraph();
    return graph?.emails.get(emailId) || null;
  }

  /**
   * Get multiple emails by IDs
   */
  async getEmails(emailIds: string[]): Promise<EmailNode[]> {
    const graph = await this.loadGraph();
    if (!graph) return [];

    const emails: EmailNode[] = [];
    for (const id of emailIds) {
      const email = graph.emails.get(id);
      if (email) emails.push(email);
    }
    return emails;
  }

  /**
   * Get all emails in a conversation
   */
  async getEmailsByConversation(conversationId: string): Promise<EmailNode[]> {
    const graph = await this.loadGraph();
    if (!graph) return [];

    const emailIds = graph.emailByConversation.get(conversationId) || [];
    return this.getEmails(emailIds);
  }

  /**
   * Get all emails from a sender
   */
  async getEmailsBySender(sender: string): Promise<EmailNode[]> {
    const graph = await this.loadGraph();
    if (!graph) return [];

    const emailIds = graph.emailBySender.get(sender) || [];
    return this.getEmails(emailIds);
  }

  /**
   * Get all emails in a date range
   */
  async getEmailsByDateRange(start: string, end: string): Promise<EmailNode[]> {
    const graph = await this.loadGraph();
    if (!graph) return [];

    const emails: EmailNode[] = [];
    for (const email of graph.emails.values()) {
      if (email.date >= start && email.date <= end) {
        emails.push(email);
      }
    }
    return emails.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get all topic clusters
   */
  async getTopicClusters(): Promise<TopicCluster[]> {
    const graph = await this.loadGraph();
    if (!graph) return [];

    return Array.from(graph.topicClusters.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get a specific topic cluster by ID
   */
  async getTopicCluster(clusterId: string): Promise<TopicCluster | null> {
    const graph = await this.loadGraph();
    return graph?.topicClusters.get(clusterId) || null;
  }

  /**
   * Get emails in a topic cluster
   */
  async getEmailsInCluster(clusterId: string): Promise<EmailNode[]> {
    const cluster = await this.getTopicCluster(clusterId);
    if (!cluster) return [];

    return this.getEmails(cluster.emailIds);
  }

  /**
   * Add or update a topic cluster
   */
  async saveTopicCluster(cluster: TopicCluster): Promise<void> {
    return this.backend.updateTopicCluster(this.userId, cluster);
  }

  /**
   * Delete a topic cluster
   */
  async deleteTopicCluster(clusterId: string): Promise<void> {
    return this.backend.deleteTopicCluster(this.userId, clusterId);
  }

  /**
   * Search emails by topic keyword
   */
  async searchTopics(keyword: string): Promise<TopicCluster[]> {
    const clusters = await this.getTopicClusters();
    const lowerKeyword = keyword.toLowerCase();

    return clusters.filter(cluster =>
      cluster.name.toLowerCase().includes(lowerKeyword) ||
      cluster.description.toLowerCase().includes(lowerKeyword) ||
      cluster.subjectVariations.some(s => s.toLowerCase().includes(lowerKeyword))
    );
  }

  /**
   * Load user preferences
   */
  async loadPreferences(): Promise<UserGraphPreferences> {
    const prefs = await this.backend.loadPreferences(this.userId);
    return prefs || {
      userId: this.userId,
      autoMergeThreshold: 0.75,
      manualMerges: {},
      manualSplits: {},
      timelineView: 'chronological',
      showBranches: true,
      clusterConfidenceThreshold: 0.5,
      expandSearchByTopic: true,
      topicExpansionLimit: 3,
      updatedAt: Date.now(),
    };
  }

  /**
   * Save user preferences
   */
  async savePreferences(preferences: UserGraphPreferences): Promise<void> {
    return this.backend.savePreferences(this.userId, preferences);
  }

  /**
   * Check if user has a graph initialized
   */
  async graphExists(): Promise<boolean> {
    return this.backend.graphExists(this.userId);
  }

  /**
   * Get graph statistics
   */
  async getStats(): Promise<{
    emailCount: number;
    topicClusterCount: number;
    connectionCount: number;
    lastUpdated: number;
  } | null> {
    const graph = await this.loadGraph();
    if (!graph) return null;

    return {
      emailCount: graph.emails.size,
      topicClusterCount: graph.topicClusters.size,
      connectionCount: graph.connections.size,
      lastUpdated: graph.lastUpdated,
    };
  }

  /**
   * Get unclustered emails (emails without topic assignments)
   */
  async getUnclusteredEmails(): Promise<EmailNode[]> {
    const graph = await this.loadGraph();
    if (!graph) return [];

    const clusteredEmailIds = new Set<string>();
    for (const cluster of graph.topicClusters.values()) {
      for (const emailId of cluster.emailIds) {
        clusteredEmailIds.add(emailId);
      }
    }

    const unclustered: EmailNode[] = [];
    for (const email of graph.emails.values()) {
      if (!clusteredEmailIds.has(email.id)) {
        unclustered.push(email);
      }
    }

    return unclustered;
  }

  /**
   * Batch add emails to graph
   * More efficient than adding emails one by one
   */
  async addEmails(emails: EmailNode[]): Promise<void> {
    let graph = await this.loadGraph();

    if (!graph) {
      // Initialize new graph
      graph = {
        emails: new Map(),
        connections: new Map(),
        topicClusters: new Map(),
        threadBranches: new Map(),
        emailByConversation: new Map(),
        emailByTopic: new Map(),
        emailBySender: new Map(),
        emailByDateRange: new Map(),
        lastUpdated: Date.now(),
        version: 1,
        userId: this.userId,
      };
    }

    // Add all emails
    for (const email of emails) {
      graph.emails.set(email.id, email);

      // Update indexes (simplified - would use the private method in real implementation)
      if (!graph.emailByConversation.has(email.conversationId)) {
        graph.emailByConversation.set(email.conversationId, []);
      }
      graph.emailByConversation.get(email.conversationId)!.push(email.id);

      if (!graph.emailBySender.has(email.from)) {
        graph.emailBySender.set(email.from, []);
      }
      graph.emailBySender.get(email.from)!.push(email.id);
    }

    graph.lastUpdated = Date.now();
    graph.version++;

    await this.saveGraph(graph);
    console.log(`[GraphStorageManager] Added ${emails.length} emails to graph`);
  }

  /**
   * Clear all graph data for user (use with caution)
   */
  async clearGraph(): Promise<void> {
    return this.backend.deleteGraph(this.userId);
  }
}
