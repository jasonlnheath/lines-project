/**
 * Multi-Model Orchestrator
 * Coordinates GLM-5, GLM-4.7, and GLM-4.5-Air for email research
 */

import { GLM5Orchestrator, OODAInsight } from './models/orchestrator';
import { SearchAgent } from './models/searchAgent';
import { AnalysisAgent, OODAResult } from './models/analysisAgent';
import { UserPersona } from './persona/personaTypes';
import { AgentQuery, AgentResponse, ToolTraceEntry, toolRegistry } from './types';

export interface MultiModelConfig {
  persona?: UserPersona | null;
  maxRounds?: number;
}

/**
 * Main orchestrator coordinating all models
 */
export class MultiModelOrchestrator {
  private orchestrator: GLM5Orchestrator;
  private searchAgent: SearchAgent;
  private analysisAgent: AnalysisAgent;
  private persona?: UserPersona | null;
  private maxRounds: number;

  constructor(config: MultiModelConfig = {}) {
    this.persona = config.persona;
    this.maxRounds = config.maxRounds || 3;

    // Initialize all agents with persona
    this.orchestrator = new GLM5Orchestrator(this.persona);
    this.searchAgent = new SearchAgent(this.persona);
    this.analysisAgent = new AnalysisAgent(this.persona);

    console.log('[MultiModelOrchestrator] Initialized', {
      persona: this.persona ? `${this.persona.displayName} (${this.persona.role} at ${this.persona.company})` : 'No persona',
      maxRounds: this.maxRounds,
    });
  }

  /**
   * Process a query using multi-model architecture
   */
  async processQuery(query: AgentQuery): Promise<AgentResponse> {
    const startTime = Date.now();
    const toolTrace: ToolTraceEntry[] = [];
    const toolResults: Record<string, any> = { ...query.previousToolResults };
    const oodaInsights: OODAInsight[] = [];

    // Context for tool execution
    const context = {
      accessToken: query.accessToken,
      userId: query.userId,
    };

    console.log(`[MultiModelOrchestrator] Processing query: "${query.query.substring(0, 50)}..."`);

    try {
      // PHASE 1: Initial research planning (GLM-5)
      console.log('[MultiModelOrchestrator] Phase 1: Planning research with GLM-5');
      const researchPlan = await this.orchestrator.planResearch(query.query);
      console.log('[MultiModelOrchestrator] Research plan:', researchPlan);

      // PHASE 2: Research rounds (up to maxRounds)
      for (let round = 1; round <= this.maxRounds; round++) {
        console.log(`[MultiModelOrchestrator] Phase 2: Research Round ${round}/${this.maxRounds}`);

        // Step 2a: Execute initial or follow-up searches (GLM-4.5-Air)
        await this.executeSearches(researchPlan.searches, context, toolTrace, toolResults);

        // Step 2b: Auto-read top emails from search results
        await this.autoReadTopEmails(toolResults, toolTrace, context);

        // Step 2c: OODA analysis (GLM-4.7)
        const oodaResult = await this.analysisAgent.performOODALoop(
          query.query,
          toolResults,
          round
        );

        // Store OODA insight
        oodaInsights.push({
          observations: oodaResult.observations,
          orientation: oodaResult.orientation,
          decision: oodaResult.decision,
        });

        console.log(`[MultiModelOrchestrator] OODA Round ${round}:`, {
          canAnswer: oodaResult.canAnswer,
          suggestedSearches: oodaResult.suggestedSearches.length,
        });

        // Step 2d: GLM-5 decides: continue or answer?
        if (round < this.maxRounds) {
          const shouldContinue = oodaResult.canAnswer
            ? false  // Analysis agent says we can answer
            : await this.orchestrator.shouldContinue(
                { observations: oodaResult.observations, orientation: oodaResult.orientation, decision: oodaResult.decision },
                round,
                this.maxRounds
              );

          if (!shouldContinue) {
            console.log('[MultiModelOrchestrator] Research complete, generating answer');
            break;
          }

          // Plan follow-up searches based on OODA suggestions or continue with analysis
          if (oodaResult.suggestedSearches.length > 0) {
            researchPlan.searches = oodaResult.suggestedSearches.map(s => ({
              tool: s.tool,
              args: s.args,
              rationale: s.rationale,
            }));
          } else {
            // Use analysis synthesis to plan next searches
            researchPlan.searches = this.synthesizeSearchPlans(oodaResult);
          }

          console.log('[MultiModelOrchestrator] Planning follow-up searches:', researchPlan.searches);
        }
      }

      // PHASE 3: Generate final answer (GLM-5)
      console.log('[MultiModelOrchestrator] Phase 3: Generating final answer with GLM-5');
      const answer = await this.orchestrator.generateAnswer(query.query, toolResults, oodaInsights);

      console.log('[MultiModelOrchestrator] Query processed', {
        answerLength: answer.length,
        rounds: oodaInsights.length,
        toolsExecuted: toolTrace.length,
        duration: Date.now() - startTime,
      });

      // Update conversation history
      const updatedHistory = [
        ...(query.conversationHistory || []),
        { role: 'user' as const, content: query.query },
        { role: 'assistant' as const, content: answer },
      ].slice(-10);

      return {
        answer,
        toolTrace,
        sources: this.extractSources(toolResults),
        conversationHistory: updatedHistory,
        toolResults,
      };
    } catch (error) {
      console.error('[MultiModelOrchestrator] Error processing query:', error);
      return {
        answer: `I encountered an error processing your query: ${error}`,
        toolTrace,
        conversationHistory: query.conversationHistory || [],
        toolResults,
      };
    }
  }

  /**
   * Execute search operations using Search Agent
   */
  private async executeSearches(
    searches: Array<{ tool: string; args: Record<string, any>; rationale: string }>,
    context: { accessToken: string; userId: string },
    toolTrace: ToolTraceEntry[],
    toolResults: Record<string, any>
  ): Promise<void> {
    // Track counts for each tool to generate unique keys
    const toolCounts: Record<string, number> = {};

    for (const search of searches) {
      console.log(`[MultiModelOrchestrator] Executing: ${search.tool} - ${JSON.stringify(search.args)} (${search.rationale})`);

      const args = search.args;

      const toolStart = Date.now();
      const tool = toolRegistry[search.tool];

      if (!tool) {
        console.warn(`[MultiModelOrchestrator] Tool not found: ${search.tool}`);
        continue;
      }

      try {
        const result = await tool.handler(args, context);
        toolTrace.push({
          tool: search.tool,
          inputs: args,
          outputs: result,
          duration: Date.now() - toolStart,
          timestamp: Date.now(),
        });

        if (result.success) {
          // Store each search result separately to avoid overwriting
          const count = toolCounts[search.tool] || 0;
          toolCounts[search.tool] = count + 1;

          // Use unique key: 'grep', 'grep_2', 'grep_3', etc.
          const resultKey = count === 0 ? search.tool : `${search.tool}_${count + 1}`;
          toolResults[resultKey] = result.data;

          console.log(`[MultiModelOrchestrator] Stored result as: ${resultKey}, found: ${result.data?.count || result.data?.total || 0} results`);
        }
      } catch (error) {
        console.error(`[MultiModelOrchestrator] Error executing ${search.tool}:`, error);
        toolTrace.push({
          tool: search.tool,
          inputs: args,
          outputs: { error: String(error) },
          duration: Date.now() - toolStart,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Auto-read top emails from search results
   */
  private async autoReadTopEmails(
    toolResults: Record<string, any>,
    toolTrace: ToolTraceEntry[],
    context: { accessToken: string; userId: string }
  ): Promise<void> {
    const emailsToRead: string[] = [];

    // Extract email IDs from ALL search results (including multiple results from same tool)
    for (const [key, result] of Object.entries(toolResults)) {
      // Skip read emails and non-search results
      if (key.startsWith('read_')) continue;

      // Handle grep results (grep, grep_2, grep_3, etc.)
      if (key.startsWith('grep')) {
        const matches = result.matches || [];
        for (const match of matches.slice(0, 3)) {
          if (match.id && !emailsToRead.includes(match.id)) {
            emailsToRead.push(match.id);
          }
        }
      }
      // Handle glob results (glob, glob_2, etc.)
      else if (key.startsWith('glob')) {
        const matches = result.matches || [];
        for (const match of matches.slice(0, 3)) {
          if (match.id && !emailsToRead.includes(match.id)) {
            emailsToRead.push(match.id);
          }
        }
      }
      // Handle fetch results (fetch, fetch_2, etc.)
      else if (key.startsWith('fetch')) {
        const messages = result.messages || [];
        for (const msg of messages.slice(0, 3)) {
          if (msg.id && !emailsToRead.includes(msg.id)) {
            emailsToRead.push(msg.id);
          }
        }
      }
    }

    // Read emails
    const readTool = toolRegistry['read'];
    for (const emailId of emailsToRead) {
      // Skip if already read
      if (toolResults[`read_${emailId}`]) continue;

      const toolStart = Date.now();
      try {
        const result = await readTool.handler({ emailId }, context);
        toolTrace.push({
          tool: 'read',
          inputs: { emailId },
          outputs: result,
          duration: Date.now() - toolStart,
          timestamp: Date.now(),
        });

        if (result.success) {
          toolResults[`read_${emailId}`] = result.data;
        }
      } catch (error) {
        console.error(`[MultiModelOrchestrator] Error reading email ${emailId}:`, error);
      }
    }

    if (emailsToRead.length > 0) {
      console.log(`[MultiModelOrchestrator] Auto-read ${emailsToRead.length} emails`);
    }
  }

  /**
   * Synthesize search plans from OODA result
   */
  private synthesizeSearchPlans(oodaResult: OODAResult): Array<{ tool: 'grep' | 'fetch' | 'glob'; args: Record<string, any>; rationale: string }> {
    // Extract search suggestions from OODA decision/synthesis
    const plans: Array<{ tool: 'grep' | 'fetch' | 'glob'; args: Record<string, any>; rationale: string }> = [];

    // Use suggested searches from analysis agent
    for (const suggestion of oodaResult.suggestedSearches) {
      plans.push({
        tool: suggestion.tool,
        args: suggestion.args,
        rationale: suggestion.rationale,
      });
    }

    // If no specific suggestions, look for names/companies in synthesis to search
    if (plans.length === 0 && oodaResult.synthesis) {
      // Look for patterns like "search for X" or "find emails from Y"
      const pattern = /(?:search|find|look for)\s+(?:emails?\s+)?(?:from\s+)?(["']?[^"'\.]+["']?)/gi;

      const matches = oodaResult.synthesis.matchAll(pattern);
      for (const match of matches) {
        const term = match[1]?.trim();
        if (term && term.length > 2) {
          plans.push({
            tool: 'grep',
            args: { pattern: term, limit: '5' },
            rationale: `Search for mentions of ${term}`,
          });
        }
      }
    }

    return plans;
  }

  /**
   * Extract sources from tool results
   */
  private extractSources(toolResults: Record<string, any>): Array<{ id: string; subject: string; from: string; date: string; snippet: string }> {
    const sources: Array<{ id: string; subject: string; from: string; date: string; snippet: string }> = [];

    // Get all read emails
    const readEmails = Object.entries(toolResults).filter(([key]) => key.startsWith('read_'));
    for (const [key, email] of readEmails) {
      // Create snippet from email body (first 100 chars)
      const snippet = email.body ? email.body.substring(0, 100).replace(/\s+/g, ' ').trim() : '';
      const date = email.date || '';

      sources.push({
        id: email.id,
        subject: email.subject || '(no subject)',
        from: email.from,
        date,
        snippet: snippet + (email.body && email.body.length > 100 ? '...' : ''),
      });
    }

    return sources;
  }
}
