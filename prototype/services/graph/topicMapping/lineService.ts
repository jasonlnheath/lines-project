/**
 * Topic Line Service
 *
 * Groups emails by semantic topics using hierarchical clustering.
 * Uses GLM-5 for topic name extraction and line quality assessment.
 *
 * This enables finding related conversations even when subjects differ.
 */

import { GLMClient, GLMMessage } from '../../agent/models/glmClient';
import { ModelRole } from '../../agent/models/modelConfig';
import {
  EmailNode,
  TopicLine,
  EmailConnection,
} from '../types';
import { SemanticAnalysis } from './embeddingService';
import { GLMEmbeddingService } from './embeddingService';

/**
 * Line merge result during hierarchical clustering
 */
interface LineMerge {
  line1: number;  // Index of first line
  line2: number;  // Index of second line
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
 * Topic Line Service
 * Implements hierarchical clustering with semantic similarity
 */
export class TopicLineService extends GLMClient {
  private embeddingService: GLMEmbeddingService;

  constructor() {
    super(ModelRole.ORCHESTRATOR); // Use GLM-5 for strategic decisions
    this.embeddingService = new GLMEmbeddingService();
  }

  /**
   * Cluster emails by thread first, then semantic similarity for orphans
   * Uses conversationId from Microsoft Graph as primary clustering key
   */
  async clusterEmails(
    emails: EmailNode[],
    threshold: number = 0.75,
    existingLines: TopicLine[] = []
  ): Promise<TopicLine[]> {
    if (emails.length === 0) {
      return [];
    }

    console.log(`[TopicLineService] Clustering ${emails.length} emails with threshold ${threshold}`);

    // Step 1: Group emails by conversationId (thread) first
    const threadGroups = new Map<string, EmailNode[]>();
    const orphanEmails: EmailNode[] = [];

    for (const email of emails) {
      const convId = email.conversationId;
      if (convId) {
        if (!threadGroups.has(convId)) {
          threadGroups.set(convId, []);
        }
        threadGroups.get(convId)!.push(email);
      } else {
        // Email without conversationId is an orphan
        orphanEmails.push(email);
      }
    }

    console.log(`[TopicLineService] Found ${threadGroups.size} existing threads, ${orphanEmails.length} orphans`);

    // Step 2: Create lines from threads (one line per thread)
    const threadLines: TopicLine[] = [];
    const now = Date.now();

    for (const [conversationId, threadEmails] of threadGroups.entries()) {
      if (threadEmails.length === 0) continue;

      // Sort emails by date within the thread
      threadEmails.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const dates = threadEmails.map(e => new Date(e.date).getTime());
      const incomingCount = threadEmails.filter(e => e.direction === 'incoming').length;
      const outgoingCount = threadEmails.filter(e => e.direction === 'outgoing').length;
      const hasOutgoing = outgoingCount > 0;

      // Determine thread status
      let threadStatus: 'incoming_only' | 'replied' | 'ongoing';
      if (!hasOutgoing) {
        threadStatus = 'incoming_only';
      } else if (incomingCount > 0) {
        threadStatus = 'ongoing';
      } else {
        threadStatus = 'replied';
      }

      const line: TopicLine = {
        id: `line-thread-${conversationId}`,  // Use FULL conversationId to avoid collisions
        name: this.generateThreadName(threadEmails),
        description: `Thread with ${threadEmails.length} emails`,
        centroidEmbedding: [],
        emailIds: threadEmails.map(e => e.id),
        subjectVariations: this.extractSubjectVariations(threadEmails),
        firstEmailDate: new Date(Math.min(...dates)).toISOString(),
        lastEmailDate: new Date(Math.max(...dates)).toISOString(),
        confidence: 1.0, // High confidence - confirmed thread from Microsoft Graph
        userConfirmed: true,
        createdAt: now,
        updatedAt: now,
        // Thread completeness status
        hasOutgoing,
        threadStatus,
        incomingCount,
        outgoingCount,
      };

      threadLines.push(line);
    }

    console.log(`[TopicLineService] Created ${threadLines.length} thread lines`);

    // Step 3: Handle orphaned emails using semantic similarity
    if (orphanEmails.length > 0) {
      console.log(`[TopicLineService] Analyzing ${orphanEmails.length} orphaned emails for semantic clustering...`);

      // Analyze orphans for semantic similarity
      const emailsWithAnalysis: EmailWithAnalysis[] = [];
      for (let i = 0; i < orphanEmails.length; i++) {
        const email = orphanEmails[i];
        const analysis = await this.embeddingService.analyzeEmail(email);

        emailsWithAnalysis.push({
          email,
          analysis,
          index: i,
        });

        console.log(`[TopicLineService] Analyzed orphan ${i + 1}/${orphanEmails.length}: concepts=${analysis.concepts.length}`);
      }

      // Calculate similarity matrix for orphans
      const similarityMatrix = this.calculateSimilarityMatrix(emailsWithAnalysis);

      // Cluster orphans with lower threshold (more permissive)
      const orphanThreshold = Math.max(0.3, threshold * 0.5);
      const orphanAssignments = this.hierarchicalClustering(
        emailsWithAnalysis,
        similarityMatrix,
        orphanThreshold
      );

      // Create lines from orphan assignments
      const orphanLines = await this.createTopicLines(
        emailsWithAnalysis,
        orphanAssignments
      );

      console.log(`[TopicLineService] Created ${orphanLines.length} orphan lines`);

      // Combine all lines
      return [...threadLines, ...orphanLines];
    }

    // No orphans - just return thread lines
    return threadLines;
  }

  /**
   * Generate a name for a thread line
   */
  private generateThreadName(emails: EmailNode[]): string {
    if (emails.length === 0) return 'Empty Thread';

    // Use the first email's subject as the base, cleaned up
    const firstSubject = emails[0].subject;

    // Remove common prefixes and markers
    let cleanSubject = firstSubject
      // Email reply/forward prefixes
      .replace(/^(RE|FW|Fwd):\s*/gi, '')
      // Calendar response prefixes
      .replace(/^(Accepted|Canceled|Declined|Tentative):\s*/gi, '')
      // External markers (various formats)
      .replace(/^EXTERNAL\s*[-:]?\s*/gi, '')
      .replace(/^\[External\]\s*/gi, '')
      .replace(/^RE:\s*\[External\]\s*/gi, '')
      .replace(/^FW:\s*\[External\]\s*/gi, '')
      // Clean up asterisks and extra spaces
      .replace(/\s*\*/g, ' ')
      .trim();

    // Truncate to match normalizeThreadName in lineTestService (no ellipsis)
    return cleanSubject.substring(0, 50);
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

    // Start with each email in its own line
    const lines: number[][] = Array.from({ length: n }, (_, i) => [i]);

    // Iteratively merge most similar lines
    while (lines.length > 1) {
      let maxSimilarity = -1;
      let merge: LineMerge | null = null;

      // Find most similar pair of lines
      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          const lineSimilarity = this.calculateLineSimilarity(
            lines[i],
            lines[j],
            similarityMatrix
          );

          if (lineSimilarity > maxSimilarity) {
            maxSimilarity = lineSimilarity;
            merge = {
              line1: i,
              line2: j,
              similarity: lineSimilarity,
            };
          }
        }
      }

      // Stop if best merge is below threshold
      if (!merge || merge.similarity < threshold) {
        break;
      }

      // Merge the two most similar lines
      const merged = [...lines[merge.line1], ...lines[merge.line2]];
      lines.splice(merge.line2, 1);
      lines.splice(merge.line1, 1);
      lines.push(merged);

      console.log(`[TopicLineService] Merged lines (${merge.line1}, ${merge.line2}) with similarity ${merge.similarity.toFixed(3)}`);
    }

    // Build final assignments
    for (let lineId = 0; lineId < lines.length; lineId++) {
      for (const emailIndex of lines[lineId]) {
        assignments.set(emailIndex, lineId);
      }
    }

    return assignments;
  }

  /**
   * Calculate similarity between two lines (average linkage)
   */
  private calculateLineSimilarity(
    line1: number[],
    line2: number[],
    similarityMatrix: number[][]
  ): number {
    let totalSimilarity = 0;
    let count = 0;

    for (const i of line1) {
      for (const j of line2) {
        totalSimilarity += similarityMatrix[i][j];
        count++;
      }
    }

    return count > 0 ? totalSimilarity / count : 0;
  }

  /**
   * Create topic lines from assignments
   * Extracts names and descriptions using GLM-5
   */
  private async createTopicLines(
    emailsWithAnalysis: EmailWithAnalysis[],
    assignments: Map<number, number>
  ): Promise<TopicLine[]> {
    // Group emails by line ID
    const lineGroups = new Map<number, EmailWithAnalysis[]>();
    for (const [emailIndex, lineId] of assignments.entries()) {
      if (!lineGroups.has(lineId)) {
        lineGroups.set(lineId, []);
      }
      lineGroups.get(lineId)!.push(emailsWithAnalysis[emailIndex]);
    }

    // Create topic lines
    const lines: TopicLine[] = [];
    for (const [lineId, group] of lineGroups.entries()) {
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
      const { name, description } = await this.generateLineName(emails, analyses);

      // Calculate confidence score
      const confidence = this.calculateLineConfidence(group, false);

      lines.push({
        id: `line-${lineId}-${Date.now()}`,
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

    return lines;
  }

  /**
   * Extract subject variations from emails in line
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
   * Generate line name and description using GLM-5
   */
  private async generateLineName(
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
      const description = `Line about ${name}. Includes ${emails.length} emails about: ${concepts.slice(0, 5).join(', ')}`;
      return { name, description };
    }

    // Otherwise, use GLM-5 to generate name
    const systemPrompt = `You are an expert at naming and describing groups of related emails.
Generate concise, descriptive names for email lines.`;

    const userPrompt = `Generate a name and description for this email line:

Number of emails: ${emails.length}

Sample subjects:
${subjects.map(s => `- ${s}`).join('\n')}

Key concepts:
${concepts.slice(0, 10).join(', ')}

Date range: ${emails[0].date} to ${emails[emails.length - 1].date}

Return JSON in this format:
{
  "name": "Brief topic name (2-5 words)",
  "description": "One sentence description of what this line is about"
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
          name: parsed.name || 'Unnamed Line',
          description: parsed.description || '',
        };
      }
    } catch (error) {
      console.warn('[TopicLineService] Failed to generate line name:', error);
    }

    // Fallback
    const fallbackName = concepts.slice(0, 2).join(' + ') || 'Email Line';
    return {
      name: fallbackName,
      description: `Group of ${emails.length} related emails`,
    };
  }

  /**
   * Calculate confidence score for a line (thread or orphan)
   * Thread lines have confidence 1.0 by default
   */
  private calculateLineConfidence(
    group: EmailWithAnalysis[],
    isThreadLine: boolean
  ): number {
    if (group.length === 0) return 0;
    if (group.length === 1) return 1.0;

    // For thread lines, confidence is based on thread structure (Microsoft Graph)
    // For orphan lines, use average pairwise similarity
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
   * Detect subject mutations within a topic line
   */
  detectSubjectMutations(line: TopicLine): string[] {
    return line.subjectVariations;
  }

  /**
   * Find emails that don't belong to any line
   * (outliers that should be handled separately)
   */
  findOutliers(
    emails: EmailNode[],
    lines: TopicLine[],
    threshold: number = 0.3
  ): EmailNode[] {
    if (lines.length === 0) {
      return emails;
    }

    // Get all lined email IDs
    const linedIds = new Set<string>();
    for (const line of lines) {
      for (const emailId of line.emailIds) {
        linedIds.add(emailId);
      }
    }

    // Find emails not in any line
    return emails.filter(e => !linedIds.has(e.id));
  }

  /**
   * Merge multiple lines into one
   */
  async mergeLines(lines: TopicLine[]): Promise<TopicLine> {
    if (lines.length === 0) {
      throw new Error('Cannot merge empty line list');
    }

    if (lines.length === 1) {
      return lines[0];
    }

    // Combine all email IDs
    const allEmailIds = Array.from(new Set(
      lines.flatMap(l => l.emailIds)
    ));

    // Combine subject variations
    const allSubjects = Array.from(new Set(
      lines.flatMap(l => l.subjectVariations)
    ));

    // Get date range
    const dates = lines.flatMap(l => [
      new Date(l.firstEmailDate).getTime(),
      new Date(l.lastEmailDate).getTime(),
    ]);
    const firstEmailDate = new Date(Math.min(...dates)).toISOString();
    const lastEmailDate = new Date(Math.max(...dates)).toISOString();

    // Generate new name and description
    const systemPrompt = `You are an expert at naming and describing merged email lines.`;
    const userPrompt = `Generate a name for this merged line:

${lines.map(l => `- ${l.name} (${l.emailIds.length} emails)`).join('\n')}

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

    let name = 'Merged Line';
    let description = `Merged line with ${allEmailIds.length} emails`;

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
      console.warn('[TopicLineService] Failed to generate merged line name:', error);
    }

    return {
      id: `line-merged-${Date.now()}`,
      name,
      description,
      centroidEmbedding: [],
      emailIds: allEmailIds,
      subjectVariations: allSubjects,
      firstEmailDate,
      lastEmailDate,
      confidence: 0.7, // Merged lines have moderate confidence
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

// Backward compatibility alias
export { TopicLineService as TopicClusteringService };
