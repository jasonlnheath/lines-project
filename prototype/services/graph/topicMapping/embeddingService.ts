/**
 * GLM Embedding Service
 *
 * Uses GLM-4.7 to generate semantic representations of emails.
 * For MVP, we extract key concepts, entities, and topics rather than raw embedding vectors.
 * This enables clustering without requiring a separate embedding API.
 *
 * Future enhancement: Integrate with actual embedding models (OpenAI, Cohere, etc.)
 */

import { GLMClient, GLMMessage } from '../../agent/models/glmClient';
import { ModelRole } from '../../agent/models/modelConfig';
import { EmailNode, Entity } from '../types';

/**
 * Result of semantic analysis of an email
 */
export interface SemanticAnalysis {
  // Key concepts (3-5 words/phrases that capture the email's meaning)
  concepts: string[];

  // Main topics
  topics: string[];

  // Named entities extracted
  entities: Entity[];

  // Sentiment analysis
  sentiment: 'positive' | 'neutral' | 'negative';

  // Keywords for search/discovery
  keywords: string[];

  // Summary (2-3 sentences)
  summary: string;

  // Conversation type
  conversationType: 'thread_start' | 'reply' | 'forward' | 'informational';

  // Urgency indicators
  urgency: 'high' | 'medium' | 'low';
}

/**
 * GLM-based embedding/semantic analysis service
 * Uses GLM-4.7 for deep semantic understanding
 */
export class GLMEmbeddingService extends GLMClient {
  constructor() {
    super(ModelRole.ANALYSIS_AGENT); // Use GLM-4.7 for deep analysis
  }

  /**
   * Generate semantic representation for an email
   * Extracts concepts, entities, topics, and sentiment
   */
  async analyzeEmail(email: EmailNode): Promise<SemanticAnalysis> {
    const systemPrompt = `You are an expert at analyzing emails to extract their semantic meaning.
Your task is to identify key concepts, topics, entities, and sentiment from email content.
Focus on business context and actionable information.`;

    const userPrompt = this.buildAnalysisPrompt(email);

    const messages: GLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      const response = await this.callGLM(messages, 1500, 0.3);
      const parsed = this.parseAnalysisResponse(response.content);
      return parsed || this.getDefaultAnalysis(email);
    } catch (error) {
      console.error('[GLMEmbeddingService] Error analyzing email:', error);
      // Return default analysis on error
      return this.getDefaultAnalysis(email);
    }
  }

  /**
   * Build prompt for email analysis
   */
  private buildAnalysisPrompt(email: EmailNode): string {
    // Truncate body for prompt (keep first 2000 chars)
    const bodySnippet = email.body ? email.body.substring(0, 2000) : '';

    return `Analyze this email and extract semantic information:

Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}
Importance: ${email.importance}

Body:
${bodySnippet}

Return your analysis as JSON in this exact format:
{
  "concepts": ["concept1", "concept2", "concept3"],
  "topics": ["topic1", "topic2"],
  "entities": [
    {"type": "person", "text": "Name", "confidence": 0.9},
    {"type": "company", "text": "Company Name", "confidence": 0.8}
  ],
  "sentiment": "positive" | "neutral" | "negative",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "summary": "2-3 sentence summary",
  "conversationType": "thread_start" | "reply" | "forward" | "informational",
  "urgency": "high" | "medium" | "low"
}

Guidelines:
- concepts: 3-5 key concepts that capture the core meaning
- topics: 1-3 main topics (project names, initiatives, etc.)
- entities: People, companies, locations mentioned
- sentiment: overall emotional tone
- keywords: Important terms for search
- conversationType: thread_start (new discussion), reply, forward, or informational
- urgency: Based on content, deadlines, and importance flag`;
  }

  /**
   * Parse JSON response from GLM
   */
  private parseAnalysisResponse(response: string): SemanticAnalysis | null {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

        // Validate and normalize the response
        return {
          concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
          topics: Array.isArray(parsed.topics) ? parsed.topics : [],
          entities: Array.isArray(parsed.entities) ? parsed.entities : [],
          sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment)
            ? parsed.sentiment
            : 'neutral',
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
          summary: parsed.summary || '',
          conversationType: ['thread_start', 'reply', 'forward', 'informational'].includes(parsed.conversationType)
            ? parsed.conversationType
            : 'informational',
          urgency: ['high', 'medium', 'low'].includes(parsed.urgency)
            ? parsed.urgency
            : 'medium',
        };
      }
    } catch (error) {
      console.warn('[GLMEmbeddingService] Failed to parse analysis response:', error);
    }

    // Fallback: return null (caller will handle)
    return null;
  }

  /**
   * Get default analysis when parsing fails
   */
  private getDefaultAnalysis(email: EmailNode): SemanticAnalysis {
    return {
      concepts: this.extractConceptsFromText(email.subject + ' ' + (email.body?.substring(0, 500) || '')),
      topics: [],
      entities: [],
      sentiment: 'neutral',
      keywords: this.extractKeywordsFromText(email.subject),
      summary: email.bodyPreview || email.subject,
      conversationType: 'informational',
      urgency: email.importance === 'high' ? 'high' : 'medium',
    };
  }

  /**
   * Simple concept extraction from text (fallback)
   */
  private extractConceptsFromText(text: string): string[] {
    // Remove common words and extract potential concepts
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4);

    // Return unique words as concepts (basic fallback)
    return Array.from(new Set(words)).slice(0, 5);
  }

  /**
   * Simple keyword extraction from text (fallback)
   */
  private extractKeywordsFromText(text: string): string[] {
    return text.split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 10);
  }

  /**
   * Batch analyze multiple emails
   * More efficient than analyzing one by one
   */
  async analyzeEmails(emails: EmailNode[]): Promise<Map<string, SemanticAnalysis>> {
    const results = new Map<string, SemanticAnalysis>();
    const batchSize = 3; // Process 3 at a time to avoid overwhelming the API

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const promises = batch.map(async (email) => {
        try {
          const analysis = await this.analyzeEmail(email);
          return { emailId: email.id, analysis };
        } catch (error) {
          console.error(`[GLMEmbeddingService] Error analyzing email ${email.id}:`, error);
          return {
            emailId: email.id,
            analysis: this.getDefaultAnalysis(email),
          };
        }
      });

      const batchResults = await Promise.all(promises);
      for (const { emailId, analysis } of batchResults) {
        results.set(emailId, analysis);
      }

      console.log(`[GLMEmbeddingService] Analyzed ${Math.min(i + batchSize, emails.length)}/${emails.length} emails`);
    }

    return results;
  }

  /**
   * Calculate semantic similarity between two emails
   * Uses concept overlap and topic matching as proxy for embedding similarity
   */
  calculateSimilarity(
    analysis1: SemanticAnalysis,
    analysis2: SemanticAnalysis
  ): number {
    let score = 0;
    let factors = 0;

    // Concept overlap (40% weight)
    const concepts1 = new Set(analysis1.concepts.map(c => c.toLowerCase()));
    const concepts2 = new Set(analysis2.concepts.map(c => c.toLowerCase()));
    const intersection = new Set([...concepts1].filter(c => concepts2.has(c)));
    const union = new Set([...concepts1, ...concepts2]);
    const conceptSim = union.size > 0 ? intersection.size / union.size : 0;
    score += conceptSim * 0.4;
    factors += 0.4;

    // Topic matching (40% weight)
    if (analysis1.topics.length > 0 && analysis2.topics.length > 0) {
      const topics1 = new Set(analysis1.topics.map(t => t.toLowerCase()));
      const topics2 = new Set(analysis2.topics.map(t => t.toLowerCase()));
      const topicIntersection = new Set([...topics1].filter(t => topics2.has(t)));
      const topicUnion = new Set([...topics1, ...topics2]);
      const topicSim = topicUnion.size > 0 ? topicIntersection.size / topicUnion.size : 0;
      score += topicSim * 0.4;
    } else {
      // If no topics extracted, use concept similarity
      score += conceptSim * 0.4;
    }
    factors += 0.4;

    // Entity overlap (10% weight)
    if (analysis1.entities.length > 0 && analysis2.entities.length > 0) {
      const entities1 = new Set(analysis1.entities.map(e => e.text.toLowerCase()));
      const entities2 = new Set(analysis2.entities.map(e => e.text.toLowerCase()));
      const entityIntersection = new Set([...entities1].filter(e => entities2.has(e)));
      const entityUnion = new Set([...entities1, ...entities2]);
      const entitySim = entityUnion.size > 0 ? entityIntersection.size / entityUnion.size : 0;
      score += entitySim * 0.1;
    }
    factors += 0.1;

    // Keyword overlap (10% weight)
    const keywords1 = new Set(analysis1.keywords.map(k => k.toLowerCase()));
    const keywords2 = new Set(analysis2.keywords.map(k => k.toLowerCase()));
    const keywordIntersection = new Set([...keywords1].filter(k => keywords2.has(k)));
    const keywordUnion = new Set([...keywords1, ...keywords2]);
    const keywordSim = keywordUnion.size > 0 ? keywordIntersection.size / keywordUnion.size : 0;
    score += keywordSim * 0.1;
    factors += 0.1;

    // Normalize score
    return factors > 0 ? score / factors : 0;
  }

  /**
   * Convert semantic analysis to EmailNode for storage
   */
  analysisToEmailNode(
    email: EmailNode,
    analysis: SemanticAnalysis,
    embedding?: number[]
  ): EmailNode {
    return {
      ...email,
      topics: analysis.topics,
      sentiment: analysis.sentiment,
      keywords: analysis.keywords,
      entities: analysis.entities,
      embedding: embedding, // Optional embedding vector if using embedding API
    };
  }
}
