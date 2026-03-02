/**
 * Agent Service Core
 * Orchestrates natural language queries with tool execution
 */

import Anthropic from '@anthropic-ai/sdk';
import { AgentQuery, AgentResponse, ToolTraceEntry, Tool, toolRegistry } from './types';

export class AgentService {
  private anthropic: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Process a natural language query
   */
  async processQuery(query: AgentQuery): Promise<AgentResponse> {
    const startTime = Date.now();
    const toolTrace: ToolTraceEntry[] = [];

    try {
      // Step 1: Analyze the query and determine which tools to use
      const toolPlan = await this.planToolExecution(query.query);

      // Step 2: Execute tools in sequence
      const toolResults: Record<string, any> = {};
      const context = {
        accessToken: query.accessToken,
        userId: query.userId,
      };

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

      // Step 3: Generate final response using Claude
      const answer = await this.generateResponse(query.query, toolResults, toolTrace);

      return {
        answer,
        toolTrace,
      };
    } catch (error) {
      return {
        answer: `I encountered an error processing your query: ${error}`,
        toolTrace,
      };
    }
  }

  /**
   * Plan which tools to execute based on the query
   */
  private async planToolExecution(query: string): Promise<Array<{ tool: string; args: any }>> {
    const systemPrompt = `You are an email assistant that helps users search and manage their emails using specific tools.

Available tools:
- read: Get full content of a specific email by ID
- grep: Search emails for text patterns
- glob: Find emails by subject/attachment filename patterns
- fetch: Get related messages, threads, or emails by date/sender
- summarize: Create a summary of email content

Analyze the user's query and determine which tools to use. Return your response as a JSON array of tool calls with this format:
[
  {"tool": "tool_name", "args": {"param": "value"}}
]

Only use the tools that are necessary. If the query is unclear, you may return an empty array.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Try to parse JSON from the response
        const jsonMatch = content.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error planning tool execution:', error);
    }

    return [];
  }

  /**
   * Generate final response based on query and tool results
   */
  private async generateResponse(
    query: string,
    toolResults: Record<string, any>,
    toolTrace: ToolTraceEntry[]
  ): Promise<string> {
    // Build context from tool results
    let context = 'Tool execution results:\n';
    for (const [tool, result] of Object.entries(toolResults)) {
      context += `\n${tool}: ${JSON.stringify(result, null, 2)}\n`;
    }

    const systemPrompt = `You are a helpful email assistant. The user has asked a question about their emails.
I've executed some tools to gather information. Your job is to provide a clear, helpful answer based on the tool results.

Be concise but thorough. If tool results are empty or show errors, let the user know.
Reference specific emails when relevant (include subject, sender, date).`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `User query: ${query}\n\n${context}` },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
    } catch (error) {
      console.error('Error generating response:', error);
    }

    return 'I was unable to process your query. Please try again.';
  }
}

/**
 * Create agent service instance
 */
export function createAgentService(): AgentService {
  return new AgentService();
}
