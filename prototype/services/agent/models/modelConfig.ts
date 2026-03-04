/**
 * Model Configuration
 * Defines model roles and their configurations for multi-model architecture
 */

/**
 * Available model roles in the system
 */
export enum ModelRole {
  ORCHESTRATOR = 'GLM-5',           // Strategic decisions, planning, final answers
  SEARCH_AGENT = 'GLM-4.5-Air',     // Fast grep/fetch operations
  ANALYSIS_AGENT = 'GLM-4.7',       // OODA loops, detailed reasoning
}

/**
 * Configuration for each model
 */
export interface ModelConfig {
  model: ModelRole;
  apiUrl: string;
  maxTokens: number;
  temperature: number;
}

/**
 * GLM API endpoint (from Z.AI)
 */
const GLM_API_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';

/**
 * Model configurations
 * Optimized for quality over cost (use GLM-4.7/5 liberally)
 */
export const MODEL_CONFIGS: Record<ModelRole, ModelConfig> = {
  [ModelRole.ORCHESTRATOR]: {
    model: ModelRole.ORCHESTRATOR,
    apiUrl: GLM_API_URL,
    maxTokens: 4000,
    temperature: 0.7,
  },
  [ModelRole.SEARCH_AGENT]: {
    model: ModelRole.SEARCH_AGENT,
    apiUrl: GLM_API_URL,
    maxTokens: 500,
    temperature: 0.3,  // Lower temp for focused, precise searches
  },
  [ModelRole.ANALYSIS_AGENT]: {
    model: ModelRole.ANALYSIS_AGENT,
    apiUrl: GLM_API_URL,
    maxTokens: 2000,
    temperature: 0.7,
  },
};

/**
 * Task types for model selection
 */
export type TaskType = 'plan' | 'search' | 'analyze' | 'answer';

/**
 * Select appropriate model for a given task type
 * Priority: Maximize quality
 */
export function selectModelForTask(taskType: TaskType): ModelRole {
  switch (taskType) {
    case 'plan':
      // Strategic planning requires highest capability
      return ModelRole.ORCHESTRATOR;
    case 'search':
      // Simple searches use fast model
      return ModelRole.SEARCH_AGENT;
    case 'analyze':
      // Deep analysis uses reasoning model
      return ModelRole.ANALYSIS_AGENT;
    case 'answer':
      // Final answers use highest capability
      return ModelRole.ORCHESTRATOR;
    default:
      return ModelRole.ANALYSIS_AGENT;  // Default to GLM-4.7
  }
}

/**
 * Get model configuration by role
 */
export function getModelConfig(role: ModelRole): ModelConfig {
  return MODEL_CONFIGS[role];
}
