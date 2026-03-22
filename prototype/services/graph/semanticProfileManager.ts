/**
 * Semantic Profile Manager
 *
 * Manages semantic profiles for topic clusters.
 * Provides incremental profile updates when emails are added to clusters.
 * Profiles include embedding centroids and key terms for enhanced search.
 *
 * Key Feature: Incremental updates - doesn't rebuild entire profile when emails are added.
 * Uses exponential moving average: new_centroid = (1 - α) * old_centroid + α * new_average
 */

import { TopicCluster, EmailNode, SemanticProfile } from './types';
import { GraphStorageManager } from './storage/graphStorageManager';

/**
 * Learning loop configuration
 */
export interface LearningLoopConfig {
  centroidUpdateWeight: number;  // α for exponential moving average (default: 0.1)
  maxKeyTerms: number;           // Keep top N terms per cluster
  cacheTTL: number;              // Profile cache TTL in milliseconds
}

const DEFAULT_CONFIG: LearningLoopConfig = {
  centroidUpdateWeight: 0.1,     // 10% weight to new data
  maxKeyTerms: 50,               // Keep top 50 terms
  cacheTTL: 5 * 60 * 1000,      // 5 minutes
};

/**
 * Semantic Profile Manager
 * Manages cluster semantic profiles with incremental updates
 */
export class SemanticProfileManager {
  private storageManager: GraphStorageManager;
  private config: LearningLoopConfig;

  // In-memory cache of profiles (Map<clusterId, SemanticProfile>)
  private profileCache: Map<string, SemanticProfile>;

  constructor(
    storageManager: GraphStorageManager,
    config?: Partial<LearningLoopConfig>
  ) {
    this.storageManager = storageManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.profileCache = new Map();
  }

  /**
   * Get semantic profile for a cluster
   * Returns cached profile if available and fresh, otherwise loads/builds it
   */
  async getProfile(clusterId: string): Promise<SemanticProfile | null> {
    // Check cache first
    const cached = this.profileCache.get(clusterId);
    if (cached && Date.now() - cached.lastUpdated < this.config.cacheTTL) {
      return cached;
    }

    // Load cluster and build profile
    const cluster = await this.storageManager.getTopicCluster(clusterId);
    if (!cluster) {
      console.warn(`[SemanticProfileManager] Cluster ${clusterId} not found`);
      return null;
    }

    // Get all emails in cluster
    const emails = await this.storageManager.getEmailsInCluster(clusterId);

    // Build profile from cluster data
    const profile = await this.buildProfile(cluster, emails);

    // Cache it
    this.profileCache.set(clusterId, profile);

    return profile;
  }

  /**
   * Update cluster's semantic profile incrementally when emails are added
   * Much faster than rebuilding the entire profile
   */
  async updateProfile(
    clusterId: string,
    addedEmails: EmailNode[]
  ): Promise<SemanticProfile | null> {
    if (addedEmails.length === 0) {
      return this.getProfile(clusterId);
    }

    const cluster = await this.storageManager.getTopicCluster(clusterId);
    if (!cluster) {
      console.warn(`[SemanticProfileManager] Cluster ${clusterId} not found for update`);
      return null;
    }

    // Get current profile
    const currentProfile = await this.getProfile(clusterId);
    if (!currentProfile) {
      // No existing profile, build from scratch
      const allEmails = await this.storageManager.getEmailsInCluster(clusterId);
      const newProfile = await this.buildProfile(cluster, allEmails);
      this.profileCache.set(clusterId, newProfile);
      return newProfile;
    }

    // Incremental update using exponential moving average
    const updatedProfile = await this.incrementalUpdate(
      currentProfile,
      addedEmails
    );

    // Update cache
    this.profileCache.set(clusterId, updatedProfile);

    return updatedProfile;
  }

  /**
   * Build semantic profile from scratch
   * Used for initial profile creation or full rebuilds
   */
  private async buildProfile(
    cluster: TopicCluster,
    emails: EmailNode[]
  ): Promise<SemanticProfile> {
    // Calculate centroid from cluster's existing embedding
    const centroid = cluster.centroidEmbedding || await this.calculateCentroid(emails);

    // Extract key terms from emails
    const keyTerms = await this.extractKeyTerms(emails);

    return {
      lineId: cluster.id,
      embeddingCentroid: centroid,
      keyTerms: this.normalizeKeyTerms(keyTerms),
      emailCount: emails.length,
      lastUpdated: Date.now(),
      version: 1,
    };
  }

  /**
   * Incremental update of semantic profile
   * Uses exponential moving average to update centroid
   */
  private async incrementalUpdate(
    currentProfile: SemanticProfile,
    addedEmails: EmailNode[]
  ): Promise<SemanticProfile> {
    const { centroidUpdateWeight: alpha } = this.config;

    // Calculate average embedding of new emails
    const newCentroid = await this.calculateCentroid(addedEmails);

    // Update centroid: (1 - α) * old + α * new
    const updatedCentroid = this.updateEmbeddingCentroid(
      currentProfile.embeddingCentroid,
      newCentroid,
      alpha
    );

    // Extract terms from new emails and merge with existing
    const newTerms = await this.extractKeyTerms(addedEmails);
    const mergedTerms = this.mergeKeyTerms(
      currentProfile.keyTerms,
      this.normalizeKeyTerms(newTerms),
      alpha
    );

    return {
      ...currentProfile,
      embeddingCentroid: updatedCentroid,
      keyTerms: mergedTerms,
      emailCount: currentProfile.emailCount + addedEmails.length,
      lastUpdated: Date.now(),
      version: currentProfile.version + 1,
    };
  }

  /**
   * Calculate centroid (average embedding) from emails
   * Uses existing embeddings if available, otherwise analyzes emails
   */
  private async calculateCentroid(emails: EmailNode[]): Promise<number[]> {
    if (emails.length === 0) {
      return [];
    }

    // Collect embeddings - use existing if available
    const embeddings: number[][] = [];
    for (const email of emails) {
      if (email.embedding && email.embedding.length > 0) {
        embeddings.push(email.embedding);
      }
    }

    // If no embeddings exist, return empty array
    // (In production, you'd call an embedding API here)
    if (embeddings.length === 0) {
      console.warn('[SemanticProfileManager] No embeddings found for centroid calculation');
      return [];
    }

    // Calculate average vector
    const dimension = embeddings[0].length;
    const centroid: number[] = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        centroid[i] += embedding[i];
      }
    }

    // Divide by count
    for (let i = 0; i < dimension; i++) {
      centroid[i] /= embeddings.length;
    }

    return centroid;
  }

  /**
   * Update embedding centroid using exponential moving average
   * new_centroid = (1 - α) * old_centroid + α * new_average
   */
  private updateEmbeddingCentroid(
    current: number[],
    newAverage: number[],
    alpha: number
  ): number[] {
    if (current.length === 0) return newAverage;
    if (newAverage.length === 0) return current;

    const dimension = Math.min(current.length, newAverage.length);
    const updated: number[] = new Array(dimension);

    for (let i = 0; i < dimension; i++) {
      updated[i] = (1 - alpha) * current[i] + alpha * newAverage[i];
    }

    return updated;
  }

  /**
   * Extract key terms from emails for search
   * Returns map of term -> weight (frequency)
   */
  private async extractKeyTerms(emails: EmailNode[]): Promise<Map<string, number>> {
    const termFreq = new Map<string, number>();

    for (const email of emails) {
      // Extract from subject (higher weight)
      const subjectTerms = this.tokenizeText(email.subject);
      for (const term of subjectTerms) {
        termFreq.set(term, (termFreq.get(term) || 0) + 3); // Subject terms get 3x weight
      }

      // Extract from keywords
      if (email.keywords) {
        for (const keyword of email.keywords) {
          const terms = this.tokenizeText(keyword);
          for (const term of terms) {
            termFreq.set(term, (termFreq.get(term) || 0) + 2); // Keywords get 2x weight
          }
        }
      }

      // Extract from topics
      if (email.topics) {
        for (const topic of email.topics) {
          const terms = this.tokenizeText(topic);
          for (const term of terms) {
            termFreq.set(term, (termFreq.get(term) || 0) + 2); // Topics get 2x weight
          }
        }
      }

      // Extract from body preview (lower weight)
      if (email.bodyPreview) {
        const bodyTerms = this.tokenizeText(email.bodyPreview);
        for (const term of bodyTerms) {
          termFreq.set(term, (termFreq.get(term) || 0) + 1);
        }
      }
    }

    return termFreq;
  }

  /**
   * Normalize key terms by TF-IDF-style scoring
   * Keep only top N terms
   */
  private normalizeKeyTerms(termFreq: Map<string, number>): Map<string, number> {
    // Convert to array and sort by frequency
    const sorted = Array.from(termFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxKeyTerms);

    // Normalize scores to 0-1
    const maxFreq = sorted[0]?.[1] || 1;
    const normalized = new Map<string, number>();

    for (const [term, freq] of sorted) {
      normalized.set(term, freq / maxFreq);
    }

    return normalized;
  }

  /**
   * Merge existing terms with new terms using exponential moving average
   */
  private mergeKeyTerms(
    existingTerms: Map<string, number>,
    newTerms: Map<string, number>,
    alpha: number
  ): Map<string, number> {
    const merged = new Map<string, number>(existingTerms);

    for (const [term, newWeight] of newTerms) {
      const existingWeight = merged.get(term) || 0;
      // EMA: new_value = (1 - α) * old + α * new
      const updatedWeight = (1 - alpha) * existingWeight + alpha * newWeight;
      merged.set(term, updatedWeight);
    }

    // Re-sort and keep top N
    return this.normalizeKeyTerms(merged);
  }

  /**
   * Tokenize text into terms
   * Lowercases, removes punctuation, filters stop words
   */
  private tokenizeText(text: string): string[] {
    if (!text) return [];

    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can', 're', 'fw',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopWords.has(term));
  }

  /**
   * Clear profile cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.profileCache.clear();
  }

  /**
   * Get all cached profiles
   */
  getCachedProfiles(): Map<string, SemanticProfile> {
    return new Map(this.profileCache);
  }
}
