/**
 * Orchestrator (GLM-5)
 * Strategic planning, coordination, final answer generation
 */

import { GLMClient, GLMMessage } from './glmClient';
import { ModelRole } from './modelConfig';
import { getOrchestratorPrompt, getAnswerGeneratorPrompt } from './prompts';
import { UserPersona } from '../persona/personaTypes';

export interface ResearchPlan {
  searches: SearchSuggestion[];
  reasoning: string;
}

export interface SearchSuggestion {
  tool: 'search' | 'fetch' | 'glob' | 'cluster_search' | 'topic_explore' | 'orphan_search';
  args: Record<string, any>;
  rationale: string;
  priority?: 'primary' | 'fallback';
}

export interface OODAInsight {
  observations: string;
  orientation: string;
  decision: string;
}

/**
 * GLM-5 Orchestrator for strategic planning and coordination
 */
export class GLM5Orchestrator extends GLMClient {
  constructor(persona?: UserPersona | null) {
    super(ModelRole.ORCHESTRATOR);
    this.persona = persona;
  }

  private persona?: UserPersona | null;

  /**
   * Plan initial research approach based on user query
   */
  async planResearch(query: string): Promise<ResearchPlan> {
    const systemPrompt = getOrchestratorPrompt(this.persona);

    const userPrompt = `USER QUERY: "${query}"

PLAN RESEARCH: Design a comprehensive research approach.

Consider:
- What's the core question?
- What entities (people, companies, topics) should we search for?
- Should we start broad or narrow?
- What would be the most effective first searches?

Provide:
1. Your reasoning for the research approach
2. Specific searches to execute (tool + parameters)

Format your response as:
REASONING: [your strategic reasoning]

SEARCHES:
[
  {"tool": "search", "args": {"query": "KQL query string"}, "rationale": "why this search"},
  {"tool": "fetch", "args": {"sender": "email@example.com", "folder": "inbox", "limit": "20"}, "rationale": "why this search"}
]

IMPORTANT:
- Use "search" tool with KQL syntax for content searches
- The search tool automatically searches BOTH inbox AND sent folders
- KQL examples: "from:john@example.com", "subject:project", "body:meeting", "importance:high"
- For fetch tool, still include "folder" parameter
- Use "args" with OBJECT, NOT STRING
- DO NOT use "query" parameter for search tool - use "args" object
- Examples:
  - search: {"args": {"query": "from:TMC"}}
  - search: {"args": {"query": "subject:project"}}
  - search: {"args": {"query": "from:john importance:high"}}
  - fetch: {"args": {"sender": "john@example.com", "folder": "inbox", "limit": "20"}}`;

    const messages: GLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      const response = await this.callGLM(messages, 1500, 0.7);
      const plan = this.parseResearchPlan(response.content);

      // Post-process: Ensure all searches have folder parameter
      // If searches are missing folder, automatically create inbox+sent versions
      const processedSearches = this.ensureFolderCoverage(plan.searches);

      // NEW: Always prepend cluster_search as the primary search
      const clusterFirstSearch: SearchSuggestion = {
        tool: 'cluster_search',
        args: {
          query: query,
          maxClusters: 5,
          includeOrphanSearch: true,
          includeThreadMerge: true,
          queueSuggestions: true,
          minScore: 0.3
        },
        rationale: 'Primary search: find relevant clusters using semantic profiles and queue suggestions',
        priority: 'primary'
      };

      return {
        searches: [clusterFirstSearch, ...processedSearches],
        reasoning: `Cluster-first search with learning loop: ${plan.reasoning}`,
      };
    } catch (error) {
      console.error('[Orchestrator] Error planning research:', error);
      // Fallback: simple search with KQL format for both folders
      return {
        searches: [
          { tool: 'search', args: { query: query }, rationale: 'Direct search for query terms' },
        ],
        reasoning: 'Fallback due to error: search for query terms directly.',
      };
    }
  }

  /**
   * Ensure all searches have folder coverage (inbox + sent)
   * Post-process parsed searches to add missing folder parameters
   * Note: search tool automatically searches both folders, so skip it
   */
  private ensureFolderCoverage(searches: SearchSuggestion[]): SearchSuggestion[] {
    const processed: SearchSuggestion[] = [];

    for (const search of searches) {
      // search tool automatically handles both folders, skip folder coverage
      if (search.tool === 'search') {
        processed.push(search);
        continue;
      }

      const hasFolder = search.args && search.args.folder;

      if (hasFolder) {
        // Already has folder, keep as-is
        processed.push(search);
      } else {
        // No folder specified, create both inbox and sent versions
        const inboxSearch = {
          ...search,
          args: { ...search.args, folder: 'inbox' },
          rationale: search.rationale + ' (inbox)',
        };
        const sentSearch = {
          ...search,
          args: { ...search.args, folder: 'sent' },
          rationale: search.rationale + ' (sent)',
        };
        processed.push(inboxSearch, sentSearch);
      }
    }

    return processed;
  }

  /**
   * Decide whether to continue research or generate final answer
   */
  async shouldContinue(
    oodaInsight: OODAInsight,
    round: number,
    maxRounds: number = 3
  ): Promise<boolean> {
    if (round >= maxRounds) {
      console.log('[Orchestrator] Max rounds reached, generating answer');
      return false;
    }

    const systemPrompt = getOrchestratorPrompt(this.persona);

    const userPrompt = `RESEARCH ROUND: ${round}/${maxRounds}

OODA ANALYSIS:
OBSERVATIONS: ${oodaInsight.observations.substring(0, 500)}...

ORIENTATION: ${oodaInsight.orientation.substring(0, 300)}...

DECISION: ${oodaInsight.decision.substring(0, 300)}...

DECIDE: Should we continue research or generate the final answer now?

Consider:
- Do we have enough specific information?
- Are there clear gaps that more research would fill?
- Would additional searches significantly improve the answer quality?

Respond with ONLY:
- "CONTINUE" if more research would meaningfully improve the answer
- "ANSWER" if we have sufficient information to provide a helpful response

Remember: We want to maximize quality, but avoid endless research.`;

    const messages: GLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      const response = await this.callGLM(messages, 200, 0.3);
      const decision = response.content.trim().toUpperCase();
      const shouldContinue = decision.includes('CONTINUE');

      console.log('[Orchestrator] Continue decision:', shouldContinue, '(' + decision + ')');
      return shouldContinue;
    } catch (error) {
      console.error('[Orchestrator] Error in continue decision:', error);
      // On error, prefer to answer
      return false;
    }
  }

  /**
   * Generate final comprehensive answer
   */
  async generateAnswer(
    query: string,
    toolResults: Record<string, any>,
    oodaInsights: OODAInsight[] = []
  ): Promise<string> {
    const systemPrompt = getAnswerGeneratorPrompt(this.persona);

    // Build comprehensive context
    let context = `USER QUERY: "${query}"\n\n`;

    // Add OODA insights
    if (oodaInsights.length > 0) {
      context += 'RESEARCH PROCESS:\n';
      for (let i = 0; i < oodaInsights.length; i++) {
        const insight = oodaInsights[i];
        context += `\nRound ${i + 1}:\n`;
        context += `  Observations: ${insight.observations.substring(0, 200)}...\n`;
        context += `  Orientation: ${insight.orientation.substring(0, 200)}...\n`;
      }
    }

    // Add all read emails (limit to avoid token bloat)
    const readEmails = Object.entries(toolResults).filter(([key]) => key.startsWith('read_'));
    if (readEmails.length > 0) {
      // Include up to 20 most recent emails with more body content
      const limitedEmails = readEmails.slice(0, 20);
      context += `\nEMAILS READ (${limitedEmails.length} of ${readEmails.length} total):\n\n`;
      for (const [key, email] of limitedEmails) {
        const emailDate = email.date ? email.date.split('T')[0] : 'unknown';
        // Include up to 4000 chars per email for full detail analysis
        const bodyPreview = email.body ? email.body.substring(0, 4000) : '';
        context += `---\n`;
        context += `From: ${email.from}\n`;
        context += `Date: ${emailDate}\n`;
        context += `Subject: ${email.subject || '(no subject)'}\n`;
        context += `Body:\n${bodyPreview}${email.body && email.body.length > 4000 ? '\n[...truncated...]' : ''}\n\n`;
      }
    }

    // Add search result summaries (handle multiple results from same tool)
    const searchResults = Object.entries(toolResults).filter(([key]) =>
      !key.startsWith('read_') && (key.startsWith('search') || key.startsWith('grep') || key.startsWith('glob') || key.startsWith('fetch'))
    );
    if (searchResults.length > 0) {
      context += `SEARCH RESULTS:\n`;
      for (const [tool, result] of searchResults) {
        if (tool.startsWith('search')) {
          const query = result.query || 'unknown';
          const count = result.totalResults || result.results?.length || 0;
          context += `- ${tool}: Found ${count} emails matching "${query}"\n`;
        } else if (tool.startsWith('grep') || tool.startsWith('glob')) {
          const pattern = result.pattern || result.subjectPattern || 'unknown';
          context += `- ${tool}: Found ${result.count} emails matching "${pattern}"\n`;
        } else if (tool.startsWith('fetch')) {
          context += `- ${tool}: Retrieved ${result.returned} of ${result.total} emails\n`;
        }
      }
    }

    const messages: GLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: context },
    ];

    try {
      // Increased tokens to handle more email content for detailed analysis
      const response = await this.callGLM(messages, 6000, 0.7);
      return response.content;
    } catch (error) {
      console.error('[Orchestrator] Error generating answer:', error);
      return 'I encountered an error generating the final answer. Please try again.';
    }
  }

  /**
   * Parse research plan from LLM response
   */
  private parseResearchPlan(response: string): ResearchPlan {
    const plan: ResearchPlan = {
      searches: [],
      reasoning: '',
    };

    // Log the raw response for debugging
    console.log('[Orchestrator] Raw GLM-5 response:', response.substring(0, 1000));

    // Extract reasoning
    const reasoningMatch = response.match(/REASONING:\s*([\s\S]+?)(?=SEARCHES:|$)/i);
    if (reasoningMatch) {
      plan.reasoning = reasoningMatch[1].trim();
    }

    // Extract searches JSON array
    const jsonMatch = response.match(/SEARCHES:\s*\[([\s\S]+)\]/i);
    if (jsonMatch) {
      try {
        const searches = JSON.parse(`[${jsonMatch[1]}]`);
        plan.searches = searches.map((s: any) => ({
          tool: s.tool,
          args: s.args || {},
          rationale: s.rationale || '',
        }));
        console.log('[Orchestrator] Parsed searches:', plan.searches);
      } catch (e) {
        console.warn('[Orchestrator] Failed to parse searches JSON:', e);
        console.log('[Orchestrator] JSON that failed:', jsonMatch[1]);
      }
    }

    // If no searches parsed, try alternative formats
    if (plan.searches.length === 0) {
      console.warn('[Orchestrator] No searches parsed, trying alternative formats...');

      // Try to find any JSON array in the response
      const anyJsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (anyJsonMatch) {
        try {
          const searches = JSON.parse(anyJsonMatch[0]);
          plan.searches = searches.map((s: any) => ({
            tool: s.tool,
            args: s.args || s.query || {},  // Handle both 'args' and legacy 'query'
            rationale: s.rationale || '',
          }));
          console.log('[Orchestrator] Parsed searches from alternative format:', plan.searches);
        } catch (e) {
          console.warn('[Orchestrator] Alternative format also failed:', e);
        }
      }
    }

    return plan;
  }
}
