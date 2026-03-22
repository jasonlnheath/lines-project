/**
 * Filesystem-based Graph Storage
 *
 * MVP storage implementation using JSON files.
 * This is a stepping stone to the PostgreSQL database schema defined in specs/technical-architecture.md
 *
 * Storage structure:
 *   public/data/graphs/{userId}/
 *     ├── emails.json
 *     ├── connections.json
 *     ├── topics.json
 *     ├── threads.json
 *     ├── preferences.json
 *     └── metadata.json
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  EmailNode,
  TopicLine,
  TopicCluster,
  EmailConnection,
  ThreadBranch,
  UserGraphPreferences,
  GraphMetadata,
  EmailKnowledgeGraph,
  Suggestion,
  BranchRecord,
} from '../types';

// File names for storage
const FILES = {
  EMAILS: 'emails.json',
  CONNECTIONS: 'connections.json',
  TOPICS: 'topics.json',
  THREADS: 'threads.json',
  PREFERENCES: 'preferences.json',
  METADATA: 'metadata.json',
  SUGGESTION_QUEUE: 'suggestion_queue.json',
  BRANCHING_HISTORY: 'branching_history.json',
} as const;

/**
 * Convert Map to plain object for JSON serialization
 */
function mapToObject<T>(map: Map<string, T>): Record<string, T> {
  const obj: Record<string, T> = {};
  for (const [key, value] of map.entries()) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Convert plain object to Map after JSON deserialization
 */
function objectToMap<T>(obj: Record<string, T>): Map<string, T> {
  return new Map(Object.entries(obj));
}

/**
 * Filesystem Graph Store
 * Handles persistence of email knowledge graph to JSON files
 */
export class FilesystemGraphStore {
  private basePath: string;

  constructor(basePath: string = 'public/data/graphs') {
    this.basePath = path.resolve(process.cwd(), basePath);
  }

  /**
   * Get the user's graph directory path
   */
  private getUserGraphPath(userId: string): string {
    return path.join(this.basePath, userId);
  }

  /**
   * Ensure user's graph directory exists
   */
  private async ensureUserDirectory(userId: string): Promise<void> {
    const userPath = this.getUserGraphPath(userId);
    try {
      await fs.mkdir(userPath, { recursive: true });
    } catch (error) {
      console.error(`[FilesystemGraphStore] Failed to create directory: ${userPath}`, error);
      throw error;
    }
  }

  /**
   * Read JSON file safely
   */
  private async readJSON<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist yet
      }
      console.error(`[FilesystemGraphStore] Failed to read ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Write JSON file safely
   */
  private async writeJSON<T>(filePath: string, data: T): Promise<void> {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[FilesystemGraphStore] Failed to write ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Load complete graph for a user
   */
  async loadGraph(userId: string): Promise<EmailKnowledgeGraph | null> {
    const userPath = this.getUserGraphPath(userId);

    // Check if metadata exists (graph has been initialized)
    const metadataPath = path.join(userPath, FILES.METADATA);
    const metadata = await this.readJSON<GraphMetadata>(metadataPath);

    if (!metadata) {
      console.log(`[FilesystemGraphStore] No graph found for user ${userId}`);
      return null;
    }

    console.log(`[FilesystemGraphStore] Loading graph for user ${userId} (${metadata.emailCount} emails)`);

    // Load all components
    const [emailsData, connectionsData, topicsData, threadsData] = await Promise.all([
      this.readJSON<Record<string, EmailNode>>(path.join(userPath, FILES.EMAILS)),
      this.readJSON<Record<string, EmailConnection>>(path.join(userPath, FILES.CONNECTIONS)),
      this.readJSON<Record<string, TopicLine>>(path.join(userPath, FILES.TOPICS)),
      this.readJSON<Record<string, ThreadBranch>>(path.join(userPath, FILES.THREADS)),
    ]);

    // Build graph
    const graph: EmailKnowledgeGraph = {
      emails: emailsData ? objectToMap(emailsData) : new Map(),
      connections: connectionsData ? objectToMap(connectionsData) : new Map(),
      topicLines: topicsData ? objectToMap(topicsData) : new Map(),
      threadBranches: threadsData ? objectToMap(threadsData) : new Map(),

      // Rebuild indexes
      emailByConversation: new Map(),
      emailByTopic: new Map(),
      emailBySender: new Map(),
      emailByDateRange: new Map(),

      lastUpdated: metadata.lastUpdated,
      version: metadata.version,
      userId: metadata.userId,
    };

    // Rebuild indexes
    this.rebuildIndexes(graph);

    return graph;
  }

  /**
   * Save complete graph for a user
   */
  async saveGraph(userId: string, graph: EmailKnowledgeGraph): Promise<void> {
    await this.ensureUserDirectory(userId);
    const userPath = this.getUserGraphPath(userId);

    console.log(`[FilesystemGraphStore] Saving graph for user ${userId} (${graph.emails.size} emails)`);

    // Save all components
    await Promise.all([
      this.writeJSON(path.join(userPath, FILES.EMAILS), mapToObject(graph.emails)),
      this.writeJSON(path.join(userPath, FILES.CONNECTIONS), mapToObject(graph.connections)),
      this.writeJSON(path.join(userPath, FILES.TOPICS), mapToObject(graph.topicLines)),
      this.writeJSON(path.join(userPath, FILES.THREADS), mapToObject(graph.threadBranches)),
    ]);

    // Update and save metadata
    const metadata: GraphMetadata = {
      userId,
      version: graph.version,
      emailCount: graph.emails.size,
      topicLineCount: graph.topicLines.size,
      connectionCount: graph.connections.size,
      lastUpdated: Date.now(),
      indexedEmails: Array.from(graph.emails.keys()),
    };

    await this.writeJSON(path.join(userPath, FILES.METADATA), metadata);

    console.log(`[FilesystemGraphStore] Graph saved successfully`);
  }

  /**
   * Add or update a single email in the graph
   */
  async updateEmail(userId: string, email: EmailNode): Promise<void> {
    let graph = await this.loadGraph(userId);

    if (!graph) {
      // Initialize new graph
      graph = {
        emails: new Map(),
        connections: new Map(),
        topicLines: new Map(),
        threadBranches: new Map(),
        emailByConversation: new Map(),
        emailByTopic: new Map(),
        emailBySender: new Map(),
        emailByDateRange: new Map(),
        lastUpdated: Date.now(),
        version: 1,
        userId,
      };
    }

    // Add/update email
    graph.emails.set(email.id, email);
    graph.lastUpdated = Date.now();
    graph.version++;

    // Update indexes
    this.updateIndexesForEmail(graph, email);

    await this.saveGraph(userId, graph);
    console.log(`[FilesystemGraphStore] Email ${email.id} updated in graph`);
  }

  /**
   * Add or update a topic line
   */
  async updateTopicLine(userId: string, line: TopicLine): Promise<void> {
    let graph = await this.loadGraph(userId);

    if (!graph) {
      throw new Error(`No graph found for user ${userId}`);
    }

    graph.topicLines.set(line.id, line);
    graph.lastUpdated = Date.now();
    graph.version++;

    // Update email-to-topic index
    for (const emailId of line.emailIds) {
      if (!graph.emailByTopic.has(emailId)) {
        graph.emailByTopic.set(emailId, []);
      }
      graph.emailByTopic.get(emailId)!.push(line.id);
    }

    await this.saveGraph(userId, graph);
    console.log(`[FilesystemGraphStore] Topic line ${line.id} updated in graph`);
  }

  /**
   * Delete a topic line
   */
  async deleteTopicLine(userId: string, lineId: string): Promise<void> {
    const graph = await this.loadGraph(userId);

    if (!graph) {
      return;
    }

    const line = graph.topicLines.get(lineId);
    if (!line) {
      return;
    }

    // Remove from email-to-topic index
    for (const emailId of line.emailIds) {
      const topicIds = graph.emailByTopic.get(emailId);
      if (topicIds) {
        const index = topicIds.indexOf(lineId);
        if (index > -1) {
          topicIds.splice(index, 1);
        }
      }
    }

    graph.topicLines.delete(lineId);
    graph.lastUpdated = Date.now();
    graph.version++;

    await this.saveGraph(userId, graph);
    console.log(`[FilesystemGraphStore] Topic line ${lineId} deleted from graph`);
  }

  // Backward compatibility aliases
  async updateTopicCluster(userId: string, cluster: TopicCluster): Promise<void> {
    return this.updateTopicLine(userId, cluster);
  }

  async deleteTopicCluster(userId: string, clusterId: string): Promise<void> {
    return this.deleteTopicLine(userId, clusterId);
  }

  /**
   * Load user preferences
   */
  async loadPreferences(userId: string): Promise<UserGraphPreferences | null> {
    const userPath = this.getUserGraphPath(userId);
    const prefs = await this.readJSON<UserGraphPreferences>(path.join(userPath, FILES.PREFERENCES));

    if (!prefs) {
      // Return default preferences
      return {
        userId,
        autoMergeThreshold: 0.75,
        manualMerges: {},
        manualSplits: {},
        timelineView: 'chronological',
        showBranches: true,
        lineConfidenceThreshold: 0.5,
        expandSearchByTopic: true,
        topicExpansionLimit: 3,
        updatedAt: Date.now(),
      };
    }

    return prefs;
  }

  /**
   * Save user preferences
   */
  async savePreferences(userId: string, preferences: UserGraphPreferences): Promise<void> {
    await this.ensureUserDirectory(userId);
    const userPath = this.getUserGraphPath(userId);

    preferences.userId = userId;
    preferences.updatedAt = Date.now();

    await this.writeJSON(path.join(userPath, FILES.PREFERENCES), preferences);
    console.log(`[FilesystemGraphStore] Preferences saved for user ${userId}`);
  }

  /**
   * Rebuild all indexes from graph data
   */
  private rebuildIndexes(graph: EmailKnowledgeGraph): void {
    // Clear existing indexes
    graph.emailByConversation.clear();
    graph.emailByTopic.clear();
    graph.emailBySender.clear();
    graph.emailByDateRange.clear();

    // Rebuild from emails
    for (const email of graph.emails.values()) {
      this.updateIndexesForEmail(graph, email);
    }

    // Rebuild email-to-topic index from lines
    for (const [lineId, line] of graph.topicLines.entries()) {
      for (const emailId of line.emailIds) {
        if (!graph.emailByTopic.has(emailId)) {
          graph.emailByTopic.set(emailId, []);
        }
        graph.emailByTopic.get(emailId)!.push(lineId);
      }
    }
  }

  /**
   * Update indexes for a single email
   */
  private updateIndexesForEmail(graph: EmailKnowledgeGraph, email: EmailNode): void {
    // Conversation index
    if (!graph.emailByConversation.has(email.conversationId)) {
      graph.emailByConversation.set(email.conversationId, []);
    }
    graph.emailByConversation.get(email.conversationId)!.push(email.id);

    // Sender index
    if (!graph.emailBySender.has(email.from)) {
      graph.emailBySender.set(email.from, []);
    }
    graph.emailBySender.get(email.from)!.push(email.id);

    // Date range index (by month)
    const dateMonth = email.date.substring(0, 7); // YYYY-MM
    if (!graph.emailByDateRange.has(dateMonth)) {
      graph.emailByDateRange.set(dateMonth, []);
    }
    graph.emailByDateRange.get(dateMonth)!.push(email.id);
  }

  /**
   * Check if graph exists for user
   */
  async graphExists(userId: string): Promise<boolean> {
    const userPath = this.getUserGraphPath(userId);
    const metadataPath = path.join(userPath, FILES.METADATA);

    try {
      await fs.access(metadataPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete entire graph for a user
   */
  async deleteGraph(userId: string): Promise<void> {
    const userPath = this.getUserGraphPath(userId);

    try {
      await fs.rm(userPath, { recursive: true, force: true });
      console.log(`[FilesystemGraphStore] Graph deleted for user ${userId}`);
    } catch (error) {
      console.error(`[FilesystemGraphStore] Failed to delete graph for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Load suggestion queue for user
   */
  async loadSuggestionQueue(userId: string): Promise<Suggestion[]> {
    const userPath = this.getUserGraphPath(userId);
    const queue = await this.readJSON<Suggestion[]>(path.join(userPath, FILES.SUGGESTION_QUEUE));
    return queue || [];
  }

  /**
   * Save suggestion queue for user
   */
  async saveSuggestionQueue(userId: string, suggestions: Suggestion[]): Promise<void> {
    await this.ensureUserDirectory(userId);
    const userPath = this.getUserGraphPath(userId);
    await this.writeJSON(path.join(userPath, FILES.SUGGESTION_QUEUE), suggestions);
    console.log(`[FilesystemGraphStore] Suggestion queue saved for user ${userId} (${suggestions.length} suggestions)`);
  }

  /**
   * Load branching history for user
   */
  async loadBranchingHistory(userId: string): Promise<BranchRecord[]> {
    const userPath = this.getUserGraphPath(userId);
    const history = await this.readJSON<BranchRecord[]>(path.join(userPath, FILES.BRANCHING_HISTORY));
    return history || [];
  }

  /**
   * Save branching history for user
   */
  async saveBranchingHistory(userId: string, history: BranchRecord[]): Promise<void> {
    await this.ensureUserDirectory(userId);
    const userPath = this.getUserGraphPath(userId);
    await this.writeJSON(path.join(userPath, FILES.BRANCHING_HISTORY), history);
    console.log(`[FilesystemGraphStore] Branching history saved for user ${userId} (${history.length} records)`);
  }
}
