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

    // Track conversations and emails already read across rounds for deduplication
    const readConversations = new Set<string>();
    const readEmails = new Set<string>();

    // Initialize with previously read emails
    for (const [key, email] of Object.entries(toolResults)) {
      if (key.startsWith('read_')) {
        readEmails.add(key.substring(5)); // Extract email ID from 'read_' prefix
        if (email.conversationId) {
          readConversations.add(email.conversationId);
        }
      }
    }

    console.log(`[MultiModelOrchestrator] Starting with ${readEmails.size} already-read emails, ${readConversations.size} conversations`);

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
        await this.autoReadTopEmails(toolResults, toolTrace, context, readConversations, readEmails);

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

          console.log(`[MultiModelOrchestrator] Stored result as: ${resultKey}, found: ${result.data?.count || result.data?.totalResults || result.data?.total || 0} results`);
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
   * Implements conversation-aware reading using Microsoft Graph conversationId
   * to avoid reading duplicate emails from the same thread
   * Also tracks already-read conversations/emails across rounds
   */
  private async autoReadTopEmails(
    toolResults: Record<string, any>,
    toolTrace: ToolTraceEntry[],
    context: { accessToken: string; userId: string },
    readConversations: Set<string>,
    readEmails: Set<string>
  ): Promise<void> {
    // Track emails by conversation for thread-aware reading
    const emailsByConversation = new Map<string, Array<{ id: string; date: string }>>();
    const emailsWithoutConversation: string[] = [];

    // Stats for deduplication
    let skippedAlreadyRead = 0;
    let skippedInRound = 0;

    // Extract email IDs from ALL search results (including multiple results from same tool)
    for (const [key, result] of Object.entries(toolResults)) {
      // Skip read emails and non-search results
      if (key.startsWith('read_')) continue;

      // Handle search results (search, search_2, search_3, etc.)
      if (key.startsWith('search')) {
        const results = result.results || [];
        console.log(`[MultiModelOrchestrator] Processing ${key}: found ${results.length} results`);
        // Debug: Log first result structure
        if (results.length > 0) {
          console.log(`[MultiModelOrchestrator] First result sample:`, JSON.stringify({
            id: results[0].id,
            conversationId: results[0].conversationId,
            hasId: !!results[0].id,
            hasConversationId: !!results[0].conversationId,
          }));
        }
        for (const item of results.slice(0, 5)) {
          if (item.id) {
            // Skip if already read in a previous round
            if (readEmails.has(item.id)) {
              skippedAlreadyRead++;
              continue;
            }

            if (item.conversationId) {
              // Skip if this conversation was already read in a previous round
              if (readConversations.has(item.conversationId)) {
                skippedAlreadyRead++;
                continue;
              }

              // Group by conversation (within this round)
              if (!emailsByConversation.has(item.conversationId)) {
                emailsByConversation.set(item.conversationId, []);
              }
              emailsByConversation.get(item.conversationId)!.push({ id: item.id, date: item.date });
              console.log(`[MultiModelOrchestrator] Added to conversation ${item.conversationId.substring(0, 8)}: ${item.id}`);
            } else {
              if (!emailsWithoutConversation.includes(item.id)) {
                emailsWithoutConversation.push(item.id);
                console.log(`[MultiModelOrchestrator] Added email without conversationId: ${item.id}`);
              }
            }
          } else {
            console.log(`[MultiModelOrchestrator] Skipping item without id:`, JSON.stringify(item).substring(0, 200));
          }
        }
      }
      // Handle grep results (grep, grep_2, grep_3, etc.)
      else if (key.startsWith('grep')) {
        const matches = result.matches || [];
        for (const match of matches.slice(0, 5)) {
          if (match.id) {
            // Skip if already read
            if (readEmails.has(match.id)) {
              skippedAlreadyRead++;
              continue;
            }

            if (match.conversationId) {
              // Skip if conversation already read
              if (readConversations.has(match.conversationId)) {
                skippedAlreadyRead++;
                continue;
              }

              if (!emailsByConversation.has(match.conversationId)) {
                emailsByConversation.set(match.conversationId, []);
              }
              emailsByConversation.get(match.conversationId)!.push({ id: match.id, date: match.date });
            } else {
              if (!emailsWithoutConversation.includes(match.id)) {
                emailsWithoutConversation.push(match.id);
              }
            }
          }
        }
      }
      // Handle glob results (glob, glob_2, etc.)
      else if (key.startsWith('glob')) {
        const matches = result.matches || [];
        for (const match of matches.slice(0, 5)) {
          if (match.id) {
            // Skip if already read
            if (readEmails.has(match.id)) {
              skippedAlreadyRead++;
              continue;
            }

            if (match.conversationId) {
              // Skip if conversation already read
              if (readConversations.has(match.conversationId)) {
                skippedAlreadyRead++;
                continue;
              }

              if (!emailsByConversation.has(match.conversationId)) {
                emailsByConversation.set(match.conversationId, []);
              }
              emailsByConversation.get(match.conversationId)!.push({ id: match.id, date: match.date });
            } else {
              if (!emailsWithoutConversation.includes(match.id)) {
                emailsWithoutConversation.push(match.id);
              }
            }
          }
        }
      }
      // Handle fetch results (fetch, fetch_2, etc.)
      else if (key.startsWith('fetch')) {
        const messages = result.messages || [];
        for (const msg of messages.slice(0, 5)) {
          if (msg.id) {
            // Skip if already read
            if (readEmails.has(msg.id)) {
              skippedAlreadyRead++;
              continue;
            }

            if (msg.conversationId) {
              // Skip if conversation already read
              if (readConversations.has(msg.conversationId)) {
                skippedAlreadyRead++;
                continue;
              }

              if (!emailsByConversation.has(msg.conversationId)) {
                emailsByConversation.set(msg.conversationId, []);
              }
              emailsByConversation.get(msg.conversationId)!.push({ id: msg.id, date: msg.date });
            } else {
              if (!emailsWithoutConversation.includes(msg.id)) {
                emailsWithoutConversation.push(msg.id);
              }
            }
          }
        }
      }
    }

    // Log conversation statistics
    const totalConversations = emailsByConversation.size;
    const totalEmailsInConversations = Array.from(emailsByConversation.values()).reduce((sum, emails) => sum + emails.length, 0);
    const totalEmailsToRead = totalEmailsInConversations + emailsWithoutConversation.length;

    // Debug: Log all keys in toolResults
    console.log(`[MultiModelOrchestrator] toolResults keys:`, Object.keys(toolResults).join(', '));
    console.log(`[MultiModelOrchestrator] Conversation-aware reading: ${totalConversations} new conversations, ${totalEmailsInConversations} new emails, ${emailsWithoutConversation.length} without conversation ID`);
    console.log(`[MultiModelOrchestrator] Deduplication: Skipped ${skippedAlreadyRead} already-read emails across rounds`);
    console.log(`[MultiModelOrchestrator] Total new emails to read: ${totalEmailsToRead}`);

    // For each conversation, only read the latest 1-2 emails
    const emailsToRead: string[] = [];
    for (const [conversationId, emails] of emailsByConversation) {
      // Sort by date (newest first)
      emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Only read latest 2 emails per conversation to avoid reading quoted content
      const latestEmails = emails.slice(0, 2);
      for (const email of latestEmails) {
        if (!emailsToRead.includes(email.id)) {
          emailsToRead.push(email.id);
        }
      }
    }

    // Add emails without conversation ID (up to 5)
    for (const emailId of emailsWithoutConversation.slice(0, 5)) {
      if (!emailsToRead.includes(emailId)) {
        emailsToRead.push(emailId);
      }
    }

    // Log deduplication statistics
    const totalEmailsFound = totalEmailsInConversations + emailsWithoutConversation.length;
    const duplicatesAvoided = totalEmailsFound - emailsToRead.length;
    console.log(`[MultiModelOrchestrator] Conversation deduplication: reading ${emailsToRead.length} of ${totalEmailsFound} emails, avoided ${duplicatesAvoided} duplicates`);

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
          // Mark as read for cross-round deduplication
          readEmails.add(emailId);
          if (result.data.conversationId) {
            readConversations.add(result.data.conversationId);
          }
        }
      } catch (error) {
        console.error(`[MultiModelOrchestrator] Error reading email ${emailId}:`, error);
      }
    }

    if (emailsToRead.length > 0) {
      console.log(`[MultiModelOrchestrator] Auto-read ${emailsToRead.length} emails (conversation-aware)`);
      console.log(`[MultiModelOrchestrator] Total read emails so far: ${readEmails.size}, conversations: ${readConversations.size}`);
    }
  }

  /**
   * Synthesize search plans from OODA result
   */
  private synthesizeSearchPlans(oodaResult: OODAResult): Array<{ tool: 'search' | 'fetch' | 'glob'; args: Record<string, any>; rationale: string }> {
    // Extract search suggestions from OODA decision/synthesis
    const plans: Array<{ tool: 'search' | 'fetch' | 'glob'; args: Record<string, any>; rationale: string }> = [];

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
            tool: 'search',
            args: { query: term, limit: '5' },
            rationale: `Search for mentions of ${term}`,
          });
        }
      }
    }

    // Ensure all searches have folder coverage (inbox + sent)
    return this.ensureFolderCoverage(plans);
  }

  /**
   * Ensure all searches have folder coverage (inbox + sent)
   * Note: search tool automatically handles both folders, so skip it
   */
  private ensureFolderCoverage(searches: Array<{ tool: 'search' | 'fetch' | 'glob'; args: Record<string, any>; rationale: string }>): Array<{ tool: 'search' | 'fetch' | 'glob'; args: Record<string, any>; rationale: string }> {
    const processed: Array<{ tool: 'search' | 'fetch' | 'glob'; args: Record<string, any>; rationale: string }> = [];

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
        processed.push({
          ...search,
          args: { ...search.args, folder: 'inbox' },
          rationale: search.rationale + ' (inbox)',
        });
        processed.push({
          ...search,
          args: { ...search.args, folder: 'sent' },
          rationale: search.rationale + ' (sent)',
        });
      }
    }

    return processed;
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
