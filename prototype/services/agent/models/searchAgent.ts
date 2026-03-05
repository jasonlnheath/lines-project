/**
 * Search Agent (GLM-4.5-Air)
 * Fast, efficient search planning and execution
 */

import { GLMClient, GLMMessage } from './glmClient';
import { ModelRole } from './modelConfig';
import { getSearchAgentPrompt } from './prompts';
import { UserPersona } from '../persona/personaTypes';
import { toolRegistry } from '../types';

export interface SearchSuggestion {
  tool: 'grep' | 'fetch' | 'glob';
  args: Record<string, any>;
  rationale: string;
}

export interface ToolPlan {
  tool: string;
  args: any;
}

/**
 * Search Agent uses GLM-4.5-Air for fast tool planning
 */
export class SearchAgent extends GLMClient {
  constructor(persona?: UserPersona | null) {
    super(ModelRole.SEARCH_AGENT);
    this.persona = persona;
  }

  private persona?: UserPersona | null;

  /**
   * Plan tools for a search query
   * Returns tool calls for grep, fetch, or glob operations
   */
  async planTools(searchQuery: string): Promise<ToolPlan[]> {
    const systemPrompt = getSearchAgentPrompt(this.persona);
    const userPrompt = `Plan search operations for: "${searchQuery}"`;

    const messages: GLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      // Increased tokens to ensure full folder search prompt is included
      const response = await this.callGLM(messages, 1000, 0.3);

      // Parse JSON array from response
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[SearchAgent] Planned tools:', parsed);
        return parsed;
      }

      // If no JSON array found, return empty
      console.warn('[SearchAgent] No valid tool plan found in response');
      return [];
    } catch (error) {
      console.error('[SearchAgent] Error planning tools:', error);
      return [];
    }
  }

  /**
   * Execute a single tool
   */
  async executeTool(
    toolCall: ToolPlan,
    context: { accessToken: string; userId: string }
  ): Promise<any> {
    const tool = toolRegistry[toolCall.tool];

    if (!tool) {
      console.error(`[SearchAgent] Tool not found: ${toolCall.tool}`);
      return { success: false, error: 'Tool not found' };
    }

    try {
      const result = await tool.handler(toolCall.args, context);
      return result;
    } catch (error) {
      console.error(`[SearchAgent] Error executing ${toolCall.tool}:`, error);
      return { success: false, error: String(error) };
    }
  }
}
