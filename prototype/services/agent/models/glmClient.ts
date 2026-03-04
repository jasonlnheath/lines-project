/**
 * GLM API Client
 * Base client for calling GLM API with retry logic
 */

import { ModelRole, MODEL_CONFIGS } from './modelConfig';

const GLM_API_KEY = process.env.GLM_API_KEY || '';

if (!GLM_API_KEY) {
  throw new Error('GLM_API_KEY environment variable is not set');
}

export interface GLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GLMResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Base GLM client with retry logic
 */
export class GLMClient {
  protected model: ModelRole;
  protected maxTokens: number;
  protected temperature: number;

  constructor(model: ModelRole) {
    const config = MODEL_CONFIGS[model];
    this.model = model;
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
  }

  /**
   * Call GLM API with retry logic for transient errors
   */
  protected async callGLM(
    messages: GLMMessage[],
    maxTokens?: number,
    temperature?: number
  ): Promise<GLMResponse> {
    const finalMaxTokens = maxTokens ?? this.maxTokens;
    const finalTemperature = temperature ?? this.temperature;
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(MODEL_CONFIGS[this.model].apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GLM_API_KEY}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            max_tokens: finalMaxTokens,
            temperature: finalTemperature,
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
          console.error(`[${this.model}] No content in response. Full data:`, JSON.stringify(data));
        }

        // Log token usage
        if (data.usage) {
          console.log(`[${this.model}] Token usage:`, {
            prompt: data.usage.prompt_tokens,
            completion: data.usage.completion_tokens,
            total: data.usage.total_tokens,
          });
        }

        return {
          content,
          model: this.model,
          usage: data.usage,
        };
      } catch (error: any) {
        lastError = error;
        const isNetworkError = error?.cause?.code === 'UND_ERR_SOCKET' ||
                               error?.cause?.code === 'ECONNRESET' ||
                               error?.message?.includes('fetch failed');

        if (isNetworkError && attempt < maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[${this.model}] Network error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delayMs}ms...`, error?.message);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error(`GLM API (${this.model}): Max retries exceeded`);
  }

  /**
   * Get the model role
   */
  getModel(): ModelRole {
    return this.model;
  }
}
