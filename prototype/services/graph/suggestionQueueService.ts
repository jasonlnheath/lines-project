/**
 * Suggestion Queue Service
 *
 * Queues suggestions for cluster improvements:
 * - orphan_branch: Unclustered emails that should join a cluster
 * - thread_merge: Other clusters that should merge into this one
 *
 * Supports two modes:
 * 1. Queue mode (default): ALL matches go to queue for user review
 * 2. Auto mode: High-confidence matches execute automatically, others queue
 *
 * When user accepts suggestions, profiles update automatically (learning loop).
 */

import { TopicCluster, EmailNode, Suggestion, BranchRecord, SemanticProfile } from './types';
import { GraphStorageManager } from './storage/graphStorageManager';
import { SemanticProfileManager } from './semanticProfileManager';

/**
 * Generate a simple unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Learning loop configuration
 */
export interface SuggestionConfig {
  autoBranchEnabled: boolean;    // Enable auto-branching (default: false)
  autoBranchThreshold: number;   // Auto-execute above this score
  queueThreshold: number;         // Queue anything above this
  maxSuggestionsPerCluster: number;
  maxThreadMergeCandidates: number;
}

const DEFAULT_CONFIG: SuggestionConfig = {
  autoBranchEnabled: false,       // Start with queue mode
  autoBranchThreshold: 0.7,       // Auto-execute if >= 0.7
  queueThreshold: 0.3,            // Queue if >= 0.3
  maxSuggestionsPerCluster: 50,
  maxThreadMergeCandidates: 10,
};

/**
 * Result of processing suggestions
 */
export interface ProcessingResult {
  queued: Suggestion[];
  autoExecuted: Suggestion[];
  rejected: Suggestion[];
}

/**
 * Suggestion Queue Service
 * Manages suggestions for cluster improvements
 */
export class SuggestionQueueService {
  private storageManager: GraphStorageManager;
  private profileManager: SemanticProfileManager;
  private config: SuggestionConfig;
  private userId: string;

  // In-memory suggestion queue (persisted to storage)
  private suggestionQueue: Map<string, Suggestion>;

  constructor(
    userId: string,
    storageManager: GraphStorageManager,
    profileManager: SemanticProfileManager,
    config?: Partial<SuggestionConfig>
  ) {
    this.userId = userId;
    this.storageManager = storageManager;
    this.profileManager = profileManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.suggestionQueue = new Map();
  }

  /**
   * Initialize the service by loading existing suggestions
   */
  async initialize(): Promise<void> {
    const saved = await this.storageManager.loadGraph();
    if (saved) {
      // Suggestions are stored in a separate file, load it
      // For now, initialize empty queue
      this.suggestionQueue = new Map();
    }
  }

  /**
   * Find suggestions for a cluster
   * Searches orphans and other clusters for potential matches
   */
  async findSuggestions(
    cluster: TopicCluster,
    options?: {
      searchOrphans?: boolean;
      searchClusters?: boolean;
      maxResults?: number;
    }
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    const profile = await this.profileManager.getProfile(cluster.id);

    if (!profile) {
      console.warn(`[SuggestionQueueService] No profile found for cluster ${cluster.id}`);
      return [];
    }

    // Search for orphan emails to branch
    if (options?.searchOrphans !== false) {
      const orphanSuggestions = await this.findOrphanBranches(cluster, profile);
      suggestions.push(...orphanSuggestions);
    }

    // Search for other clusters to merge
    if (options?.searchClusters !== false) {
      const mergeSuggestions = await this.findThreadMerges(cluster, profile);
      suggestions.push(...mergeSuggestions);
    }

    // Sort by match score (highest first) and limit
    suggestions.sort((a, b) => b.matchScore - a.matchScore);
    const maxResults = options?.maxResults ?? this.config.maxSuggestionsPerCluster;

    return suggestions.slice(0, maxResults);
  }

  /**
   * Find orphan emails that should branch into this cluster
   */
  private async findOrphanBranches(
    cluster: TopicCluster,
    profile: SemanticProfile
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Get unclustered emails
    const unclustered = await this.storageManager.getUnclusteredEmails();
    const clusterEmailIds = new Set(cluster.emailIds);

    // Filter out emails already in this cluster
    const orphans = unclustered.filter(e => !clusterEmailIds.has(e.id));

    for (const orphan of orphans) {
      const score = await this.calculateOrphanSimilarity(orphan, profile);

      if (score >= this.config.queueThreshold) {
        suggestions.push({
          id: generateId(),
          targetLineId: cluster.id,
          type: 'orphan_branch',
          sourceEmailId: orphan.id,
          matchScore: score,
          reason: this.generateOrphanReason(orphan, score),
          queuedAt: Date.now(),
          status: 'pending',
        });
      }
    }

    return suggestions;
  }

  /**
   * Find other clusters that should merge into this one
   */
  private async findThreadMerges(
    cluster: TopicCluster,
    profile: SemanticProfile
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Get all other clusters
    const allClusters = await this.storageManager.getTopicClusters();
    const otherClusters = allClusters.filter(c => c.id !== cluster.id);

    // Calculate similarity to each cluster
    for (const otherCluster of otherClusters) {
      const otherProfile = await this.profileManager.getProfile(otherCluster.id);
      if (!otherProfile) continue;

      const score = this.calculateClusterSimilarity(profile, otherProfile);

      if (score >= this.config.queueThreshold) {
        suggestions.push({
          id: generateId(),
          targetLineId: cluster.id,
          type: 'thread_merge',
          sourceLineId: otherCluster.id,
          matchScore: score,
          reason: this.generateMergeReason(otherCluster, score),
          queuedAt: Date.now(),
          status: 'pending',
        });
      }
    }

    // Sort by score and limit
    suggestions.sort((a, b) => b.matchScore - a.matchScore);
    return suggestions.slice(0, this.config.maxThreadMergeCandidates);
  }

  /**
   * Calculate similarity between an orphan email and cluster profile
   */
  private async calculateOrphanSimilarity(
    email: EmailNode,
    profile: SemanticProfile
  ): Promise<number> {
    let score = 0;
    let factors = 0;

    // Check if email has embedding
    if (email.embedding && email.embedding.length > 0 && profile.embeddingCentroid.length > 0) {
      // Cosine similarity between email embedding and cluster centroid
      const cosineSim = this.cosineSimilarity(email.embedding, profile.embeddingCentroid);
      score += cosineSim * 0.6; // 60% weight on embedding similarity
      factors += 0.6;
    }

    // Key term overlap
    const emailTerms = new Set([
      ...this.tokenizeText(email.subject),
      ...email.keywords,
      ...email.topics,
    ].map(t => t.toLowerCase()));

    let termOverlap = 0;
    let termMatches = 0;
    for (const term of emailTerms) {
      if (profile.keyTerms.has(term)) {
        termOverlap += profile.keyTerms.get(term)!;
        termMatches++;
      }
    }

    if (emailTerms.size > 0) {
      const termScore = termMatches > 0 ? termOverlap / emailTerms.size : 0;
      score += termScore * 0.4; // 40% weight on term overlap
      factors += 0.4;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Calculate similarity between two cluster profiles
   */
  private calculateClusterSimilarity(
    profile1: SemanticProfile,
    profile2: SemanticProfile
  ): number {
    let score = 0;
    let factors = 0;

    // Centroid similarity (cosine similarity between embedding centroids)
    if (profile1.embeddingCentroid.length > 0 && profile2.embeddingCentroid.length > 0) {
      const centroidSim = this.cosineSimilarity(
        profile1.embeddingCentroid,
        profile2.embeddingCentroid
      );
      score += centroidSim * 0.7; // 70% weight on centroid similarity
      factors += 0.7;
    }

    // Key term overlap
    const terms1 = new Set(profile1.keyTerms.keys());
    const terms2 = new Set(profile2.keyTerms.keys());
    const intersection = new Set([...terms1].filter(t => terms2.has(t)));
    const union = new Set([...terms1, ...terms2]);

    if (union.size > 0) {
      const jaccard = intersection.size / union.size;
      score += jaccard * 0.3; // 30% weight on term overlap
      factors += 0.3;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;

    const dimension = Math.min(a.length, b.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < dimension; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Generate human-readable reason for orphan suggestion
   */
  private generateOrphanReason(email: EmailNode, score: number): string {
    const confidence = score >= 0.7 ? 'high' : score >= 0.5 ? 'medium' : 'low';
    return `Email "${email.subject}" has ${confidence} similarity to this cluster (${(score * 100).toFixed(0)}% match)`;
  }

  /**
   * Generate human-readable reason for merge suggestion
   */
  private generateMergeReason(cluster: TopicCluster, score: number): string {
    const confidence = score >= 0.7 ? 'high' : score >= 0.5 ? 'medium' : 'low';
    return `Cluster "${cluster.name}" has ${confidence} similarity to this cluster (${(score * 100).toFixed(0)}% match)`;
  }

  /**
   * Process suggestions based on configuration
   * Returns queued and auto-executed suggestions
   */
  async processSuggestions(suggestions: Suggestion[]): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      queued: [],
      autoExecuted: [],
      rejected: [],
    };

    for (const suggestion of suggestions) {
      // Filter based on mode and thresholds
      if (this.config.autoBranchEnabled && suggestion.matchScore >= this.config.autoBranchThreshold) {
        // Auto-execute
        result.autoExecuted.push(suggestion);
        await this.executeSuggestion(suggestion);
      } else if (suggestion.matchScore >= this.config.queueThreshold) {
        // Queue for review
        result.queued.push(suggestion);
        await this.queueSuggestion(suggestion);
      } else {
        // Below threshold, reject
        result.rejected.push(suggestion);
      }
    }

    return result;
  }

  /**
   * Queue a suggestion for user review
   */
  async queueSuggestion(suggestion: Suggestion): Promise<void> {
    this.suggestionQueue.set(suggestion.id, suggestion);
    await this.persistQueue();
  }

  /**
   * Get pending suggestions for a cluster
   */
  async getPendingSuggestions(lineId: string): Promise<Suggestion[]> {
    return Array.from(this.suggestionQueue.values())
      .filter(s => s.targetLineId === lineId && s.status === 'pending')
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Get all pending suggestions across all clusters
   */
  async getAllPendingSuggestions(): Promise<Map<string, Suggestion[]>> {
    const byCluster = new Map<string, Suggestion[]>();

    for (const suggestion of this.suggestionQueue.values()) {
      if (suggestion.status !== 'pending') continue;

      const existing = byCluster.get(suggestion.targetLineId) || [];
      existing.push(suggestion);
      byCluster.set(suggestion.targetLineId, existing);
    }

    return byCluster;
  }

  /**
   * User accepts a suggestion - execute the merge/branch
   */
  async acceptSuggestion(suggestionId: string): Promise<void> {
    const suggestion = this.suggestionQueue.get(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`);
    }

    await this.executeSuggestion(suggestion);

    // Update status
    suggestion.status = 'accepted';
    this.suggestionQueue.set(suggestionId, suggestion);
    await this.persistQueue();
  }

  /**
   * User rejects a suggestion - remove from queue
   */
  async rejectSuggestion(suggestionId: string): Promise<void> {
    const suggestion = this.suggestionQueue.get(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`);
    }

    suggestion.status = 'rejected';
    this.suggestionQueue.set(suggestionId, suggestion);
    await this.persistQueue();
  }

  /**
   * Execute a suggestion (merge or branch)
   * Updates cluster and triggers profile update
   */
  private async executeSuggestion(suggestion: Suggestion): Promise<void> {
    const cluster = await this.storageManager.getTopicCluster(suggestion.targetLineId);
    if (!cluster) {
      console.error(`[SuggestionQueueService] Target cluster ${suggestion.targetLineId} not found`);
      return;
    }

    if (suggestion.type === 'orphan_branch' && suggestion.sourceEmailId) {
      // Branch orphan into cluster
      await this.branchOrphan(cluster, suggestion.sourceEmailId);
    } else if (suggestion.type === 'thread_merge' && suggestion.sourceLineId) {
      // Merge cluster into this one
      await this.mergeCluster(cluster, suggestion.sourceLineId);
    }

    // Create branch record for audit
    await this.createBranchRecord(suggestion);
  }

  /**
   * Branch an orphan email into a cluster
   */
  private async branchOrphan(cluster: TopicCluster, emailId: string): Promise<void> {
    // Add email to cluster
    cluster.emailIds.push(emailId);

    // Get the email to update cluster metadata
    const email = await this.storageManager.getEmail(emailId);
    if (email) {
      // Update dates if needed
      if (email.date < cluster.firstEmailDate) {
        cluster.firstEmailDate = email.date;
      }
      if (email.date > cluster.lastEmailDate) {
        cluster.lastEmailDate = email.date;
      }
    }

    // Update cluster metadata
    cluster.branchCount = (cluster.branchCount || 0) + 1;
    cluster.lastMergeAt = Date.now();
    cluster.updatedAt = Date.now();

    // Save cluster
    await this.storageManager.saveTopicCluster(cluster);

    // Update semantic profile
    if (email) {
      await this.profileManager.updateProfile(cluster.id, [email]);
    }

    console.log(`[SuggestionQueueService] Branched email ${emailId} into cluster ${cluster.id}`);
  }

  /**
   * Merge a cluster into another cluster
   */
  private async mergeCluster(targetCluster: TopicCluster, sourceClusterId: string): Promise<void> {
    const sourceCluster = await this.storageManager.getTopicCluster(sourceClusterId);
    if (!sourceCluster) {
      console.error(`[SuggestionQueueService] Source cluster ${sourceClusterId} not found`);
      return;
    }

    // Add all emails from source to target
    for (const emailId of sourceCluster.emailIds) {
      if (!targetCluster.emailIds.includes(emailId)) {
        targetCluster.emailIds.push(emailId);
      }
    }

    // Merge subject variations
    for (const subject of sourceCluster.subjectVariations) {
      if (!targetCluster.subjectVariations.includes(subject)) {
        targetCluster.subjectVariations.push(subject);
      }
    }

    // Update cluster metadata
    targetCluster.branchCount = (targetCluster.branchCount || 0) + sourceCluster.emailIds.length;
    targetCluster.lastMergeAt = Date.now();
    targetCluster.updatedAt = Date.now();

    // Update dates
    if (sourceCluster.firstEmailDate < targetCluster.firstEmailDate) {
      targetCluster.firstEmailDate = sourceCluster.firstEmailDate;
    }
    if (sourceCluster.lastEmailDate > targetCluster.lastEmailDate) {
      targetCluster.lastEmailDate = sourceCluster.lastEmailDate;
    }

    // Save target cluster
    await this.storageManager.saveTopicCluster(targetCluster);

    // Delete source cluster
    await this.storageManager.deleteTopicLine(sourceClusterId);

    // Update semantic profile with all new emails
    const newEmails = await this.storageManager.getEmails(sourceCluster.emailIds);
    await this.profileManager.updateProfile(targetCluster.id, newEmails);

    console.log(`[SuggestionQueueService] Merged cluster ${sourceClusterId} into ${targetCluster.id}`);
  }

  /**
   * Create a branch record for audit trail
   */
  private async createBranchRecord(suggestion: Suggestion): Promise<void> {
    const record: BranchRecord = {
      suggestionId: suggestion.id,
      type: suggestion.type,
      targetLineId: suggestion.targetLineId,
      sourceId: suggestion.sourceEmailId || suggestion.sourceLineId || '',
      confidence: suggestion.matchScore,
      executedAt: Date.now(),
      userApproved: true,
    };

    // Save to storage (implementation depends on your storage layer)
    await this.storageManager.saveBranchingHistory?.(record);
  }

  /**
   * Persist suggestion queue to storage
   */
  private async persistQueue(): Promise<void> {
    // Convert Map to array for storage
    const suggestions = Array.from(this.suggestionQueue.values());

    // Save to storage (implementation depends on your storage layer)
    await this.storageManager.saveSuggestionQueue?.(suggestions);
  }

  /**
   * Tokenize text into terms
   */
  private tokenizeText(text: string): string[] {
    if (!text) return [];

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SuggestionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SuggestionConfig {
    return { ...this.config };
  }
}
