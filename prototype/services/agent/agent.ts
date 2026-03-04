/**
 * Agent Service Core
 * Orchestrates natural language queries with tool execution
 * Uses Z.AI Coding API (requires dev plan subscription)
 */

import { AgentQuery, AgentResponse, ToolTraceEntry, Tool, toolRegistry, Message } from './types';

// Z.AI coding endpoint (requires dev plan subscription)
const GLM_API_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';

export class AgentService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GLM_API_KEY || '';
    // Default to GLM-4.7 (Sonnet equivalent) for coding/dev plan
    this.model = process.env.GLM_MODEL || 'GLM-4.7';
    if (!this.apiKey) {
      throw new Error('GLM_API_KEY environment variable is not set');
    }
  }

  /**
   * Process a natural language query with multi-round research
   */
  async processQuery(query: AgentQuery): Promise<AgentResponse> {
    const startTime = Date.now();
    const toolTrace: ToolTraceEntry[] = [];

    // Initialize or continue conversation history
    const conversationHistory = query.conversationHistory || [];

    // Start with previous tool results if available
    const toolResults = { ...query.previousToolResults };

    // Context for tool execution
    const context = {
      accessToken: query.accessToken,
      userId: query.userId,
    };

    const MAX_ROUNDS = 3;
    let currentRound = 0;

    try {
      while (currentRound < MAX_ROUNDS) {
        console.log(`[processQuery] Round ${currentRound + 1}/${MAX_ROUNDS}`);

        // Step 1: Plan tools based on query + accumulated results
        const toolPlan = await this.planToolExecution(query.query, conversationHistory, toolResults);

        // If no tools planned, we're done with research
        if (toolPlan.length === 0) {
          console.log('[processQuery] No tools planned, ending research');
          break;
        }

        // Step 2: Execute planned tools
        for (const toolCall of toolPlan) {
          const toolStart = Date.now();
          const tool = toolRegistry[toolCall.tool];

          if (!tool) {
            toolTrace.push({
              tool: toolCall.tool,
              inputs: toolCall.args,
              outputs: { error: 'Tool not found' },
              duration: Date.now() - toolStart,
              timestamp: Date.now(),
            });
            continue;
          }

          const result = await tool.handler(toolCall.args, context);
          toolTrace.push({
            tool: toolCall.tool,
            inputs: toolCall.args,
            outputs: result,
            duration: Date.now() - toolStart,
            timestamp: Date.now(),
          });

          if (result.success) {
            toolResults[toolCall.tool] = result.data;
          }
        }

        // Step 3: Auto-read top emails from search results
        await this.autoReadTopEmails(toolResults, toolTrace, context);

        // Step 4: Decide if we need more research (unless this was the last round)
        if (currentRound < MAX_ROUNDS - 1) {
          const shouldContinue = await this.shouldContinueResearch(query.query, toolResults, conversationHistory);
          if (!shouldContinue) {
            console.log('[processQuery] LLM indicates we have enough information');
            break;
          }
          console.log('[processQuery] LLM recommends more research, continuing...');
        }

        currentRound++;
      }

      // Step 5: Generate final response using GLM
      const answer = await this.generateResponse(query.query, toolResults, toolTrace, conversationHistory);

      console.log('[processQuery] Generated answer length:', answer.length);
      console.log('[processQuery] Generated answer preview:', answer.substring(0, 200));

      // Update conversation history
      const updatedHistory: Message[] = [
        ...conversationHistory,
        { role: 'user', content: query.query },
        { role: 'assistant', content: answer },
      ];

      // Keep only last 10 messages to avoid token bloat
      const trimmedHistory = updatedHistory.slice(-10);

      return {
        answer,
        toolTrace,
        conversationHistory: trimmedHistory,
        toolResults,
      };
    } catch (error) {
      return {
        answer: `I encountered an error processing your query: ${error}`,
        toolTrace,
        conversationHistory,
        toolResults,
      };
    }
  }

  /**
   * Call GLM API with retry logic for transient errors
   */
  private async callGLM(messages: Array<{ role: string; content: string }>, maxTokens: number = 1000): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(GLM_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            max_tokens: maxTokens,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`GLM API error: ${response.status} ${error}`);
        }

        const data = await response.json();

        // GLM-4.7 may use reasoning_content instead of content
        const message = data.choices?.[0]?.message;
        const content = message?.content || message?.reasoning_content || '';

        if (!content) {
          console.error('[callGLM] No content in response. Full data:', JSON.stringify(data));
        }

        return content;
      } catch (error: any) {
        lastError = error;
        const isNetworkError = error?.cause?.code === 'UND_ERR_SOCKET' ||
                               error?.cause?.code === 'ECONNRESET' ||
                               error?.message?.includes('fetch failed');

        if (isNetworkError && attempt < maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[callGLM] Network error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delayMs}ms...`, error?.message);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('GLM API: Max retries exceeded');
  }

  /**
   * Plan which tools to execute based on the query
   */
  private async planToolExecution(
    query: string,
    conversationHistory: Message[] = [],
    previousToolResults: Record<string, any> = {}
  ): Promise<Array<{ tool: string; args: any }>> {
    let contextInfo = '';

    // Add context from previous tool results
    if (Object.keys(previousToolResults).length > 0) {
      contextInfo += '\n\nPrevious tool results available:\n';
      for (const [tool, result] of Object.entries(previousToolResults)) {
        // Format results intelligently based on tool type to preserve email IDs
        if (tool.startsWith('read_')) {
          // Auto-read email - show full content for context
          const emailId = tool.replace('read_', '');
          const subject = result.subject || '(no subject)';
          const emailDate = result.date ? result.date.split('T')[0] : '';
          const bodyPreview = result.body?.substring(0, 150) || '';
          contextInfo += `- read: Email from ${result.from} | Date: ${emailDate} | Subject: ${subject}\n`;
          contextInfo += `  Body: ${bodyPreview}...\n`;
        } else if (tool === 'grep' || tool === 'glob') {
          const matches = result.matches || [];
          contextInfo += `- ${tool}: Found ${result.count} emails. First 3:\n`;
          for (const match of matches.slice(0, 3)) {
            const subject = match.subject || '(no subject)';
            const matchDate = match.date ? match.date.split('T')[0] : '';
            contextInfo += `  • ID: ${match.id} | From: ${match.from} | Date: ${matchDate} | Subject: ${subject}\n`;
          }
          if (matches.length > 3) {
            contextInfo += `  • ... and ${matches.length - 3} more\n`;
          }
        } else if (tool === 'fetch') {
          const messages = result.messages || [];
          contextInfo += `- ${tool}: Retrieved ${result.returned} of ${result.total} emails. First 3:\n`;
          for (const msg of messages.slice(0, 3)) {
            const subject = msg.subject || '(no subject)';
            const msgDate = msg.date ? msg.date.split('T')[0] : '';
            contextInfo += `  • ID: ${msg.id} | From: ${msg.from} | Date: ${msgDate} | Subject: ${subject}\n`;
          }
        } else {
          // Fallback for other tools - truncate but show structure
          contextInfo += `- ${tool}: ${JSON.stringify(result).substring(0, 500)}...\n`;
        }
      }
    }

    // Add conversation context
    if (conversationHistory.length > 0) {
      contextInfo += '\n\nRecent conversation:\n';
      for (const msg of conversationHistory.slice(-4)) {
        contextInfo += `${msg.role}: ${msg.content.substring(0, 100)}...\n`;
      }
    }

    // Add current date for context
    const today = new Date().toISOString().split('T')[0];
    contextInfo += `\n\nToday's date: ${today}\n`;

    const systemPrompt = `You are an email assistant that helps users search and manage their emails.

Available tools:
- fetch: List/retrieve emails from the inbox. Use this to:
  * Get a count of emails ("how many emails")
  * Get recent emails without filters (just provide limit parameter)
  * Get emails from a specific sender
  * Get emails within a date range
  * Required parameters: none (all are optional)
  * Response includes: "returned" (emails in this batch), "total" (total matching), "hasMore" (if more exist)
  * Example: {"tool": "fetch", "args": {"limit": "50"}}
  * IMPORTANT: When asked "how many emails", report the "total" field, NOT "returned"

- grep: Search emails by content/keywords. Use this for:
  * Finding emails containing specific text or phrases
  * Content-based searches
  * Required: pattern (the keyword to search for)
  * Response includes "count" (matching emails found) and "matches" array
  * Example: {"tool": "grep", "args": {"pattern": "project update", "limit": "5"}}

- glob: Find emails by subject line patterns with wildcards. Use for:
  * Subject pattern matching (e.g., "*invoice*", "report-*")
  * Attachment filename patterns (e.g., "*.pdf")
  * Example: {"tool": "glob", "args": {"subjectPattern": "*invoice*", "limit": "5"}}

- read: Get full content of a specific email by ID
  * Required: emailId
  * Use when user says "read it", "show me", "full content", or references a previous email
  * IMPORTANT: Copy the EXACT email ID from previous grep/glob/fetch results (e.g., "AAMkAGVmMk...")
  * Example: {"tool": "read", "args": {"emailId": "AAMkAGVmMk3ZmYwLTQ4MmItNDFjMC04Zjk4LWYwMmEwNzM4YjFmBGgAAAAU1GM..."}}

- summarize: Create summary of email content
  * Required: emailId
  * Example: {"tool": "summarize", "args": {"emailId": "ABC123"}}

IMPORTANT guidelines:
1. For "how many emails" questions: use fetch tool, report the "total" field
2. For broad questions like "show me recent emails": use fetch with limit, show "returned" emails
3. For keyword searches: use grep
4. For subject pattern searches: use glob
5. For follow-up questions like "read it", "tell me more":
   * Use the "id" field from previous grep/glob/fetch results
   * ALWAYS copy the EXACT email ID (e.g., "AAMkAGVmMk...")
   * Example: {"tool": "read", "args": {"emailId": "AAMkAGVmMk..."}}
6. For multi-round research (when you find people/companies mentioned):
   * Use fetch with sender parameter to get recent emails from that person
   * Example: {"tool": "fetch", "args": {"sender": "josh@example.com", "limit": "5"}}
   * This catches recent emails that might not mention your original search terms
7. Always include a reasonable limit (5-10) to avoid overwhelming results and reduce latency
8. If total > returned, mention there are more emails available
${contextInfo}

Return your response as a JSON array of tool calls:
[
  {"tool": "tool_name", "args": {"param": "value"}}
]

Only use the tools that are necessary. If the query is unclear, return an empty array.`;

    let response = '';
    try {
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-6), // Include recent conversation
        { role: 'user', content: query },
      ];

      response = await this.callGLM(messages, 500);

      // Try to parse JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[planToolExecution] Parsed tool plan:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('[planToolExecution] ERROR:', error);
      console.error('[planToolExecution] Query was:', query);
      console.error('[planToolExecution] GLM response was:', response?.substring(0, 500));
      return [];
    }

    return [];
  }

  /**
   * Generate final response based on query and tool results
   */
  private async generateResponse(
    query: string,
    toolResults: Record<string, any>,
    toolTrace: ToolTraceEntry[],
    conversationHistory: Message[] = []
  ): Promise<string> {
    // Build context from tool results - format intelligently
    let context = 'Tool execution results:\n';

    // First, show full email content for any read emails
    const readEmails = Object.entries(toolResults).filter(([key]) => key.startsWith('read_'));
    if (readEmails.length > 0) {
      context += '\n=== FULL EMAIL CONTENT READ ===\n';
      for (const [key, email] of readEmails) {
        context += `\n--- Email from ${email.from} ---\n`;
        context += `Subject: ${email.subject || '(no subject)'}\n`;
        context += `Date: ${email.date}\n`;
        context += `Body:\n${email.body}\n`;
      }
    }

    // Then show search results (just metadata, snippets already in read emails)
    const searchResults = Object.entries(toolResults).filter(([key]) =>
      !key.startsWith('read_') && ['grep', 'glob', 'fetch'].includes(key)
    );
    if (searchResults.length > 0) {
      context += '\n=== SEARCH RESULTS ===\n';
      for (const [tool, result] of searchResults) {
        if (tool === 'grep' || tool === 'glob') {
          context += `\n${tool}: Found ${result.count} emails matching "${result.pattern || result.subjectPattern}"\n`;
        } else if (tool === 'fetch') {
          context += `\n${tool}: Retrieved ${result.returned} of ${result.total} emails\n`;
        }
      }
    }

    const systemPrompt = `You are a helpful email assistant. The user has asked a question about their emails.
I've executed some tools to gather information. Your job is to provide a clear, helpful answer based on the tool results.

IMPORTANT:
- You have FULL EMAIL CONTENT available (shown above)
- Use the full email bodies to provide accurate, detailed answers
- Reference specific emails by subject and sender
- If multiple emails discuss the same topic, summarize the key points from all of them
- Be thorough - the user wants the actual information from the emails, not just summaries of summaries

Be concise but thorough. If tool results are empty or show errors, let the user know.`;

    try {
      // Build messages with conversation history
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-6),
        { role: 'user', content: `User query: ${query}\n\n${context}` },
      ];

      const response = await this.callGLM(messages, 4000);

      console.log('[generateResponse] GLM response length:', response.length);
      console.log('[generateResponse] GLM response preview:', response.substring(0, 200));

      return response;
    } catch (error) {
      console.error('Error generating response:', error);
      return 'I was unable to process your query. Please try again.';
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
    const searchTools = ['grep', 'glob', 'fetch'];
    const emailsToRead: string[] = [];

    for (const toolName of searchTools) {
      const result = toolResults[toolName];
      if (!result) continue;

      // Extract email IDs from search results
      if (toolName === 'grep' || toolName === 'glob') {
        const matches = result.matches || [];
        // Take first 3 most relevant (already sorted by date/relevance)
        for (const match of matches.slice(0, 3)) {
          if (match.id && !emailsToRead.includes(match.id)) {
            emailsToRead.push(match.id);
          }
        }
      } else if (toolName === 'fetch') {
        const messages = result.messages || [];
        for (const msg of messages.slice(0, 3)) {
          if (msg.id && !emailsToRead.includes(msg.id)) {
            emailsToRead.push(msg.id);
          }
        }
      }
    }

    // Auto-read the most relevant emails
    for (const emailId of emailsToRead) {
      // Skip if already read
      if (toolResults[`read_${emailId}`]) continue;

      const toolStart = Date.now();
      const readTool = toolRegistry['read'];

      if (readTool) {
        const result = await readTool.handler({ emailId }, context);
        toolTrace.push({
          tool: 'read',
          inputs: { emailId },
          outputs: result,
          duration: Date.now() - toolStart,
          timestamp: Date.now(),
        });

        if (result.success) {
          // Store with a unique key per email
          toolResults[`read_${emailId}`] = result.data;
        }
      }
    }
  }

  /**
   * Ask LLM if we need more research or can answer the query
   */
  private async shouldContinueResearch(
    query: string,
    toolResults: Record<string, any>,
    conversationHistory: Message[] = []
  ): Promise<boolean> {
    // Build summary of what we've learned
    let summary = 'Information gathered so far:\n';

    const readEmails = Object.entries(toolResults).filter(([key]) => key.startsWith('read_'));
    if (readEmails.length > 0) {
      summary += `\nRead ${readEmails.length} full emails:\n`;
      for (const [key, email] of readEmails.slice(0, 5)) {
        // Extract just the date part from ISO timestamp
        const emailDate = email.date ? email.date.split('T')[0] : 'unknown date';
        summary += `- ${email.from} (${emailDate}): ${email.subject || '(no subject)'}\n`;
      }
    }

    const searchResults = Object.entries(toolResults).filter(([key]) =>
      !key.startsWith('read_') && ['grep', 'glob', 'fetch'].includes(key)
    );
    if (searchResults.length > 0) {
      for (const [tool, result] of searchResults) {
        if (tool === 'grep' || tool === 'glob') {
          summary += `\nFound ${result.count} emails matching "${result.pattern || result.subjectPattern}"\n`;
        } else if (tool === 'fetch') {
          summary += `\nRetrieved ${result.returned} of ${result.total} emails\n`;
        }
      }
    }

    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are a research assistant deciding if more information is needed.

The user asked: "${query}"

Today's date: ${today}

${summary}

Analyze what we've found and what the user is asking for. Consider:
- Do we have the LATEST information? (check email dates - if newest emails are old, search for recent ones)
- Are there people mentioned whose recent emails we should check? (e.g., "Josh Wootton", "Gary", etc.)
- Are there company names mentioned that we should search for?
- Would searching for recent emails from specific senders provide the latest updates?

IMPORTANT: Prefer CONTINUE when:
- You find names of people who are key to the situation (search their recent emails)
- The newest emails we have are more than a few days old (search for recent activity)
- Companies or topics are mentioned that warrant deeper research

Prefer ANSWER when:
- We have recent emails from key people
- Additional searches wouldn't add significant new information

Respond with ONLY:
- "CONTINUE" if more research would help
- "ANSWER" if we have enough information to provide a helpful answer`;

    try {
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Do we need more research or can we answer now?' },
      ];

      const response = await this.callGLM(messages, 200);
      const decision = response.trim().toUpperCase();

      console.log('[shouldContinueResearch] LLM decision:', decision);

      return decision === 'CONTINUE';
    } catch (error) {
      console.error('[shouldContinueResearch] Error:', error);
      // On error, prefer to stop to avoid infinite loops
      return false;
    }
  }
}

/**
 * Create agent service instance
 */
export function createAgentService(): AgentService {
  return new AgentService();
}
