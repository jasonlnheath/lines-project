/**
 * Topic Clustering Service
 *
 * Groups emails by semantic topics using hierarchical clustering.
 * Uses GLM-5 for topic name extraction and cluster quality assessment.
 *
 * This enables finding related conversations even when subjects differ.
 */

import { GLMClient, GLMMessage } from '../../agent/models/glmClient';
import { ModelRole } from '../../agent/models/modelConfig';
import {
  EmailNode,
  TopicCluster,
  EmailConnection,
} from '../types';
import { SemanticAnalysis } from './embeddingService';
import { GLMEmbeddingService } from './embeddingService';

/**
 * Cluster merge result during hierarchical clustering
 */
interface ClusterMerge {
  cluster1: number;  // Index of first cluster
  cluster2: number;  // Index of second cluster
  similarity: number; // Similarity score
}

/**
 * Email with analysis for clustering
 */
interface EmailWithAnalysis {
  email: EmailNode;
  analysis: SemanticAnalysis;
  index: number; // Position in input array
}

/**
 * Topic Clustering Service
 * Implements hierarchical clustering with semantic similarity
 */
export class TopicClusteringService extends GLMClient {
  private embeddingService: GLMEmbeddingService;

  constructor() {
    super(ModelRole.ORCHESTRATOR); // Use GLM-5 for strategic decisions
    this.embeddingService = new GLMEmbeddingService();
  }

  /**
   * Cluster emails by semantic similarity
   * Uses hierarchical clustering with configurable threshold
   */
  async clusterEmails(
    emails: EmailNode[],
    threshold: number = 0.75,
    existingClusters: TopicCluster[] = []
  ): Promise<TopicCluster[]> {
    if (emails.length === 0) {
      return [];
    }

    console.log(`[TopicClusteringService] Clustering ${emails.length} emails with threshold ${threshold}`);

    // Step 1: Analyze all emails (or use existing analysis)
    const emailsWithAnalysis: EmailWithAnalysis[] = [];
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      // Check if email already has analysis data
      if (email.topics.length > 0 || email.keywords.length > 0) {
        emailsWithAnalysis.push({
          email,
          analysis: {
            concepts: [],
            topics: email.topics,
            entities: email.entities,
            sentiment: email.sentiment || 'neutral',
            keywords: email.keywords,
            summary: email.bodyPreview || '',
            conversationType: 'informational',
            urgency: 'medium',
          },
          index: i,
        });
      } else {
        // Need to analyze
        const analysis = await this.embeddingService.analyzeEmail(email);
        emailsWithAnalysis.push({
          email,
          analysis,
          index: i,
        });
      }
    }

    // Step 2: Calculate similarity matrix
    const similarityMatrix = this.calculateSimilarityMatrix(emailsWithAnalysis);

    // Step 3: Perform hierarchical clustering
    const clusterAssignments = this.hierarchicalClustering(
      emailsWithAnalysis,
      similarityMatrix,
      threshold
    );

    // Step 4: Extract topics and names using GLM-5
    const clusters = await this.createTopicClusters(
      emailsWithAnalysis,
      clusterAssignments
    );

    console.log(`[TopicClusteringService] Created ${clusters.length} topic clusters`);
    return clusters;
  }

  /**
   * Calculate similarity matrix between all email pairs
   */
  private calculateSimilarityMatrix(
    emailsWithAnalysis: EmailWithAnalysis[]
  ): number[][] {
    const n = emailsWithAnalysis.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const similarity = this.embeddingService.calculateSimilarity(
          emailsWithAnalysis[i].analysis,
          emailsWithAnalysis[j].analysis
        );
        matrix[i][j] = similarity;
        matrix[j][i] = similarity;
      }
    }

    return matrix;
  }

  /**
   * Perform hierarchical agglomerative clustering
   */
  private hierarchicalClustering(
    emailsWithAnalysis: EmailWithAnalysis[],
    similarityMatrix: number[][],
    threshold: number
  ): Map<number, number> {
    const n = emailsWithAnalysis.length;
    const assignments = new Map<number, number>();

    // Start with each email in its own cluster
    const clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);

    // Iteratively merge most similar clusters
    while (clusters.length > 1) {
      let maxSimilarity = -1;
      let merge: ClusterMerge | null = null;

      // Find most similar pair of clusters
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const clusterSimilarity = this.calculateClusterSimilarity(
            clusters[i],
            clusters[j],
            similarityMatrix
          );

          if (clusterSimilarity > maxSimilarity) {
            maxSimilarity = clusterSimilarity;
            merge = {
              cluster1: i,
              cluster2: j,
              similarity: clusterSimilarity,
            };
          }
        }
      }

      // Stop if best merge is below threshold
      if (!merge || merge.similarity < threshold) {
        break;
      }

      // Merge the two most similar clusters
      const merged = [...clusters[merge.cluster1], ...clusters[merge.cluster2]];
      clusters.splice(merge.cluster2, 1);
      clusters.splice(merge.cluster1, 1);
      clusters.push(merged);

      console.log(`[TopicClusteringService] Merged clusters (${merge.cluster1}, ${merge.cluster2}) with similarity ${merge.similarity.toFixed(3)}`);
    }

    // Build final assignments
    for (let clusterId = 0; clusterId < clusters.length; clusterId++) {
      for (const emailIndex of clusters[clusterId]) {
        assignments.set(emailIndex, clusterId);
      }
    }

    return assignments;
  }

  /**
   * Calculate similarity between two clusters (average linkage)
   */
  private calculateClusterSimilarity(
    cluster1: number[],
    cluster2: number[],
    similarityMatrix: number[][]
  ): number {
    let totalSimilarity = 0;
    let count = 0;

    for (const i of cluster1) {
      for (const j of cluster2) {
        totalSimilarity += similarityMatrix[i][j];
        count++;
      }
    }

    return count > 0 ? totalSimilarity / count : 0;
  }

  /**
   * Create topic clusters from assignments
   * Extracts names and descriptions using GLM-5
   */
  private async createTopicClusters(
    emailsWithAnalysis: EmailWithAnalysis[],
    assignments: Map<number, number>
  ): Promise<TopicCluster[]> {
    // Group emails by cluster ID
    const clusterGroups = new Map<number, EmailWithAnalysis[]>();
    for (const [emailIndex, clusterId] of assignments.entries()) {
      if (!clusterGroups.has(clusterId)) {
        clusterGroups.set(clusterId, []);
      }
      clusterGroups.get(clusterId)!.push(emailsWithAnalysis[emailIndex]);
    }

    // Create topic clusters
    const clusters: TopicCluster[] = [];
    for (const [clusterId, group] of clusterGroups.entries()) {
      if (group.length === 0) continue;

      const emails = group.map(e => e.email);
      const analyses = group.map(e => e.analysis);

      // Extract subject variations
      const subjectVariations = this.extractSubjectVariations(emails);

      // Get date range
      const dates = emails.map(e => new Date(e.date).getTime());
      const firstEmailDate = new Date(Math.min(...dates)).toISOString();
      const lastEmailDate = new Date(Math.max(...dates)).toISOString();

      // Generate name and description using GLM-5
      const { name, description } = await this.generateClusterName(emails, analyses);

      // Calculate confidence score
      const confidence = this.calculateClusterConfidence(group);

      clusters.push({
        id: `cluster-${clusterId}-${Date.now()}`,
        name,
        description,
        centroidEmbedding: [], // Not used in MVP (using concepts instead)
        emailIds: emails.map(e => e.id),
        subjectVariations,
        firstEmailDate,
        lastEmailDate,
        confidence,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return clusters;
  }

  /**
   * Extract subject variations from emails in cluster
   */
  private extractSubjectVariations(emails: EmailNode[]): string[] {
    const subjects = new Set(emails.map(e => e.subject));

    // Group similar subjects (basic implementation)
    const variations: string[] = [];
    for (const subject of subjects) {
      const lower = subject.toLowerCase();
      const isDuplicate = variations.some(v =>
        v.toLowerCase().includes(lower.substring(0, 20)) ||
        lower.includes(v.toLowerCase().substring(0, 20))
      );

      if (!isDuplicate) {
        variations.push(subject);
      }
    }

    return variations;
  }

  /**
   * Generate cluster name and description using GLM-5
   */
  private async generateClusterName(
    emails: EmailNode[],
    analyses: SemanticAnalysis[]
  ): Promise<{ name: string; description: string }> {
    // Extract sample data for prompt
    const subjects = emails.slice(0, 5).map(e => e.subject);
    const concepts = analyses.flatMap(a => a.concepts);
    const topics = analyses.flatMap(a => a.topics);

    // If we have topics from analysis, use them
    if (topics.length > 0) {
      const uniqueTopics = Array.from(new Set(topics));
      const name = uniqueTopics.slice(0, 2).join(' + ');
      const description = `Cluster about ${name}. Includes ${emails.length} emails about: ${concepts.slice(0, 5).join(', ')}`;
      return { name, description };
    }

    // Otherwise, use GLM-5 to generate name
    const systemPrompt = `You are an expert at naming and describing groups of related emails.
Generate concise, descriptive names for email clusters.`;

    const userPrompt = `Generate a name and description for this email cluster:

Number of emails: ${emails.length}

Sample subjects:
${subjects.map(s => `- ${s}`).join('\n')}

Key concepts:
${concepts.slice(0, 10).join(', ')}

Date range: ${emails[0].date} to ${emails[emails.length - 1].date}

Return JSON in this format:
{
  "name": "Brief topic name (2-5 words)",
  "description": "One sentence description of what this cluster is about"
}`;

    const messages: GLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      const response = await this.callGLM(messages, 500, 0.5);
      const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                       response.content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return {
          name: parsed.name || 'Unnamed Cluster',
          description: parsed.description || '',
        };
      }
    } catch (error) {
      console.warn('[TopicClusteringService] Failed to generate cluster name:', error);
    }

    // Fallback
    const fallbackName = concepts.slice(0, 2).join(' + ') || 'Email Cluster';
    return {
      name: fallbackName,
      description: `Group of ${emails.length} related emails`,
    };
  }

  /**
   * Calculate confidence score for a cluster
   * Based on internal similarity and coherence
   */
  private calculateClusterConfidence(group: EmailWithAnalysis[]): number {
    if (group.length === 0) return 0;
    if (group.length === 1) return 1.0;

    // Calculate average pairwise similarity
    let totalSimilarity = 0;
    let count = 0;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const similarity = this.embeddingService.calculateSimilarity(
          group[i].analysis,
          group[j].analysis
        );
        totalSimilarity += similarity;
        count++;
      }
    }

    return count > 0 ? totalSimilarity / count : 0;
  }

  /**
   * Detect subject mutations within a topic cluster
   */
  detectSubjectMutations(cluster: TopicCluster): string[] {
    return cluster.subjectVariations;
  }

  /**
   * Find emails that don't belong to any cluster
   * (outliers that should be handled separately)
   */
  findOutliers(
    emails: EmailNode[],
    clusters: TopicCluster[],
    threshold: number = 0.3
  ): EmailNode[] {
    if (clusters.length === 0) {
      return emails;
    }

    // Get all clustered email IDs
    const clusteredIds = new Set<string>();
    for (const cluster of clusters) {
      for (const emailId of cluster.emailIds) {
        clusteredIds.add(emailId);
      }
    }

    // Find emails not in any cluster
    return emails.filter(e => !clusteredIds.has(e.id));
  }

  /**
   * Merge multiple clusters into one
   */
  async mergeClusters(clusters: TopicCluster[]): Promise<TopicCluster> {
    if (clusters.length === 0) {
      throw new Error('Cannot merge empty cluster list');
    }

    if (clusters.length === 1) {
      return clusters[0];
    }

    // Combine all email IDs
    const allEmailIds = Array.from(new Set(
      clusters.flatMap(c => c.emailIds)
    ));

    // Combine subject variations
    const allSubjects = Array.from(new Set(
      clusters.flatMap(c => c.subjectVariations)
    ));

    // Get date range
    const dates = clusters.flatMap(c => [
      new Date(c.firstEmailDate).getTime(),
      new Date(c.lastEmailDate).getTime(),
    ]);
    const firstEmailDate = new Date(Math.min(...dates)).toISOString();
    const lastEmailDate = new Date(Math.max(...dates)).toISOString();

    // Generate new name and description
    const systemPrompt = `You are an expert at naming and describing merged email clusters.`;
    const userPrompt = `Generate a name for this merged cluster:

${clusters.map(c => `- ${c.name} (${c.emailIds.length} emails)`).join('\n')}

Total emails: ${allEmailIds.length}

Return JSON:
{
  "name": "Merged topic name (2-5 words)",
  "description": "One sentence description"
}`;

    const messages: GLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let name = 'Merged Cluster';
    let description = `Merged cluster with ${allEmailIds.length} emails`;

    try {
      const response = await this.callGLM(messages, 500, 0.5);
      const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                       response.content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        name = parsed.name || name;
        description = parsed.description || description;
      }
    } catch (error) {
      console.warn('[TopicClusteringService] Failed to generate merged cluster name:', error);
    }

    return {
      id: `cluster-merged-${Date.now()}`,
      name,
      description,
      centroidEmbedding: [],
      emailIds: allEmailIds,
      subjectVariations: allSubjects,
      firstEmailDate,
      lastEmailDate,
      confidence: 0.7, // Merged clusters have moderate confidence
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}
