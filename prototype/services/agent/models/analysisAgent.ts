/**
 * Analysis Agent (GLM-4.7)
 * OODA loop for deep reasoning and analysis
 */

import { GLMClient, GLMMessage } from './glmClient';
import { ModelRole } from './modelConfig';
import { getAnalysisAgentPrompt, getOODADecisionPrompt } from './prompts';
import { UserPersona } from '../persona/personaTypes';

export interface OODAResult {
  observations: string;      // OBSERVE: What did we find?
  orientation: string;       // ORIENT: How does it relate to user's needs?
  decision: string;          // DECIDE: Continue or answer?
  suggestedSearches: SearchSuggestion[];
  canAnswer: boolean;
  synthesis?: string;        // Final synthesis when canAnswer = true
}

export interface SearchSuggestion {
  tool: 'search' | 'fetch' | 'glob';
  args: Record<string, any>;
  rationale: string;
}

/**
 * Analysis Agent uses GLM-4.7 for OODA loop analysis
 */
export class AnalysisAgent extends GLMClient {
  constructor(persona?: UserPersona | null) {
    super(ModelRole.ANALYSIS_AGENT);
    this.persona = persona;
  }

  private persona?: UserPersona | null;

  /**
   * Perform full OODA loop analysis
   */
  async performOODALoop(
    query: string,
    toolResults: Record<string, any>,
    round: number
  ): Promise<OODAResult> {
    // Step 1: OBSERVE - What did we find?
    const observations = await this.observe(toolResults);

    // Step 2: ORIENT - Contextualize with user's needs
    const orientation = await this.orient(query, observations, toolResults);

    // Step 3: DECIDE - Continue or answer?
    const decision = await this.decide(query, observations, orientation, round);

    // Step 4: ACT - Generate action recommendations
    if (decision.shouldContinue) {
      return {
        observations,
        orientation,
        decision: decision.reasoning,
        suggestedSearches: decision.suggestedSearches || [],
        canAnswer: false,
      };
    } else {
      // Generate synthesis for final answer
      const synthesis = await this.synthesize(query, observations, orientation, toolResults);
      return {
        observations,
        orientation,
        decision: decision.reasoning,
        suggestedSearches: [],
        canAnswer: true,
        synthesis,
      };
    }
  }

  /**
   * OBSERVE: Examine search results and email content
   */
  private async observe(toolResults: Record<string, any>): Promise<string> {
    // Build structured observation of what we found
    const observations: string[] = [];

    // Check read emails (full content)
    const readEmails = Object.entries(toolResults).filter(([key]) => key.startsWith('read_'));
    if (readEmails.length > 0) {
      observations.push(`EMAILS READ (${readEmails.length}):`);
      for (const [key, email] of readEmails.slice(0, 5)) {
        const emailDate = email.date ? email.date.split('T')[0] : 'unknown date';
        observations.push(`  - From: ${email.from} | Date: ${emailDate} | Subject: ${email.subject || '(no subject)'}`);
        // Include more email body for proper analysis - up to 2000 chars
        const bodyPreview = email.body?.substring(0, 2000) || '';
        if (bodyPreview) {
          observations.push(`    Body: ${bodyPreview}${email.body && email.body.length > 2000 ? '\n    [...truncated...]' : ''}`);
        }
      }
    }

    // Check search results (search/grep/glob/fetch) - handle multiple results from same tool
    const searchResults = Object.entries(toolResults).filter(([key]) =>
      !key.startsWith('read_') && (key.startsWith('search') || key.startsWith('grep') || key.startsWith('glob') || key.startsWith('fetch'))
    );

    if (searchResults.length > 0) {
      observations.push('\nSEARCH RESULTS:');
      for (const [tool, result] of searchResults) {
        if (tool.startsWith('search')) {
          const count = result.totalResults || result.results?.length || 0;
          const query = result.query || 'unknown';
          observations.push(`  - ${tool}: Found ${count} emails matching "${query}"`);
          // Show first few matches
          const results = result.results || [];
          for (const item of results.slice(0, 3)) {
            const itemDate = item.date ? item.date.split('T')[0] : '';
            observations.push(`    • ${item.from} | ${itemDate} | ${item.subject || '(no subject)'}`);
          }
        } else if (tool.startsWith('grep') || tool.startsWith('glob')) {
          const pattern = result.pattern || result.subjectPattern || 'unknown';
          const count = result.count || 0;
          observations.push(`  - ${tool}: Found ${count} emails matching "${pattern}"`);
          // Show first few matches
          const matches = result.matches || [];
          for (const match of matches.slice(0, 3)) {
            const matchDate = match.date ? match.date.split('T')[0] : '';
            observations.push(`    • ${match.from} | ${matchDate} | ${match.subject || '(no subject)'}`);
          }
        } else if (tool.startsWith('fetch')) {
          observations.push(`  - ${tool}: Retrieved ${result.returned} of ${result.total} emails`);
        }
      }
    }

    if (observations.length === 0) {
      return 'No search results available yet.';
    }

    return observations.join('\n');
  }

  /**
   * ORIENT: Contextualize findings with user's needs
   */
  private async orient(
    query: string,
    observations: string,
    toolResults: Record<string, any>
  ): Promise<string> {
    const systemPrompt = getAnalysisAgentPrompt(this.persona);

    const userPrompt = `USER QUERY: "${query}"

OBSERVATIONS:
${observations}

ORIENT: How do these findings relate to the user's query and context?
- What's the core question being asked?
- What's relevant vs. irrelevant?
- What's missing?
- What are the key entities (people, companies, topics)?

Provide a concise orientation (2-3 paragraphs).`;

    const messages: GLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      // Increased tokens to handle longer observations with full email content
      const response = await this.callGLM(messages, 2500, 0.7);
      return response.content;
    } catch (error) {
      console.error('[AnalysisAgent] Error in ORIENT phase:', error);
      return 'Unable to orient findings due to error.';
    }
  }

  /**
   * DECIDE: Determine if we should continue research or answer now
   */
  private async decide(
    query: string,
    observations: string,
    orientation: string,
    round: number
  ): Promise<{
    shouldContinue: boolean;
    reasoning: string;
    suggestedSearches?: SearchSuggestion[];
  }> {
    // Build simplified observations for decision
    const simplifiedObs = this.simplifyObservations(observations);

    const decisionPrompt = getOODADecisionPrompt(query, round, simplifiedObs, this.persona);

    const messages: GLMMessage[] = [
      { role: 'system', content: decisionPrompt },
      { role: 'user', content: 'Do we need more research or can we answer now?' },
    ];

    try {
      // Use more tokens for decision to handle larger observations and ensure complete JSON response
      const response = await this.callGLM(messages, 2000, 0.3);
      const decision = response.content.trim().toUpperCase();

      console.log('[AnalysisAgent] DECISION:', decision);

      if (decision.includes('CONTINUE')) {
        // Extract search suggestions from the response
        const suggestedSearches = this.extractSearchSuggestions(response.content);
        return {
          shouldContinue: true,
          reasoning: response.content,
          suggestedSearches,
        };
      } else {
        return {
          shouldContinue: false,
          reasoning: response.content,
        };
      }
    } catch (error) {
      console.error('[AnalysisAgent] Error in DECIDE phase:', error);
      // On error, prefer to stop
      return {
        shouldContinue: false,
        reasoning: 'Error during decision phase, defaulting to answer.',
      };
    }
  }

  /**
   * SYNTHESIZE: Generate final synthesis when we're ready to answer
   */
  private async synthesize(
    query: string,
    observations: string,
    orientation: string,
    toolResults: Record<string, any>
  ): Promise<string> {
    const systemPrompt = getAnalysisAgentPrompt(this.persona);

    const userPrompt = `USER QUERY: "${query}"

OBSERVATIONS:
${observations}

ORIENTATION:
${orientation}

SYNTHESIZE: Provide a comprehensive synthesis of all findings that directly answers the user's question.
- Be specific and detailed
- Reference specific emails
- Organize information clearly
- Consider the user's role and context`;

    const messages: GLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      // Increased tokens to handle more email content for proper synthesis
      const response = await this.callGLM(messages, 3000, 0.7);
      return response.content;
    } catch (error) {
      console.error('[AnalysisAgent] Error in SYNTHESIZE phase:', error);
      return 'Unable to synthesize findings due to error.';
    }
  }

  /**
   * Simplify observations for decision making
   * Keep enough context to determine if emails are relevant to the query
   */
  private simplifyObservations(observations: string): string {
    // Don't simplify - pass full observations to decision model
    // The decision model needs full context to determine if relevant emails were found
    return observations;
  }

  /**
   * Extract search suggestions from LLM response
   * Parses JSON response format from OODA decision prompt
   */
  private extractSearchSuggestions(response: string): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    try {
      // Try to find JSON code block in response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.log('[AnalysisAgent] No JSON found in decision response, checking for plain text suggestions');
        // Fallback: look for plain text search recommendations
        return this.extractPlainTextSearches(response);
      }

      let jsonStr = jsonMatch[1] || jsonMatch[0];

      // Handle truncated JSON by removing incomplete trailing objects
      // If JSON ends with incomplete object, try to close it
      if (jsonStr.includes('"RATIONALE":') && !jsonStr.endsWith('}')) {
        // Find the last complete object and close arrays/objects
        const lastCompleteObj = jsonStr.lastIndexOf('},');
        if (lastCompleteObj > 0) {
          jsonStr = jsonStr.substring(0, lastCompleteObj + 1) + '\n  ]\n}';
        }
      }

      const parsed = JSON.parse(jsonStr);

      if (parsed.searches && Array.isArray(parsed.searches)) {
        for (const search of parsed.searches) {
          if (search.tool && (search.query || search.args)) {
            // For 'search' tool, ensure args format is correct
            const args = search.args || (search.query ? { query: search.query } : {});
            suggestions.push({
              tool: search.tool,
              args,
              rationale: search.rationale || '',
            });
          }
        }
        console.log(`[AnalysisAgent] Extracted ${suggestions.length} search suggestions from JSON`);
      }
    } catch (error) {
      console.log('[AnalysisAgent] Failed to parse JSON from decision response:', error);
      console.log('[AnalysisAgent] Response was:', response.substring(0, 500));
      // Fallback to plain text extraction
      return this.extractPlainTextSearches(response);
    }

    return suggestions;
  }

  /**
   * Fallback: Extract search suggestions from plain text
   */
  private extractPlainTextSearches(response: string): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    // Look for RECOMMEND_CONTINUE patterns
    const recommendMatch = response.match(/RECOMMEND_CONTINUE:\s*(.+?)(?:\n|$)/i);
    if (recommendMatch) {
      const recommendation = recommendMatch[1].trim();
      console.log('[AnalysisAgent] Found plain text recommendation:', recommendation);

      // Try to extract search terms and tools from the recommendation
      const searchMatch = recommendation.match(/(?:search|search for)\s+["']?([^"'\n]+)["']?/i);
      if (searchMatch) {
        suggestions.push({
          tool: 'search',
          args: { query: searchMatch[1].trim() },
          rationale: recommendation,
        });
      }

      const fetchMatch = recommendation.match(/fetch\s+(?:emails?\s+)?(?:from\s+)?["']?([^"'\n]+)["']?/i);
      if (fetchMatch) {
        suggestions.push({
          tool: 'fetch',
          args: { sender: fetchMatch[1].trim() },
          rationale: recommendation,
        });
      }
    }

    return suggestions;
  }
}
