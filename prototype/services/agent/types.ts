/**
 * Agent Service Types
 * Core types for the agent-based search system
 */

export interface Tool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  handler: (params: any, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    enum?: string[];
  }>;
  required?: string[];
}

export interface ToolContext {
  accessToken: string;
  userId: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface AgentQuery {
  query: string;
  userId: string;
  accessToken: string;
}

export interface AgentResponse {
  answer: string;
  toolTrace: ToolTraceEntry[];
  sources?: EmailSource[];
}

export interface ToolTraceEntry {
  tool: string;
  inputs: any;
  outputs: any;
  duration: number;
  timestamp: number;
}

export interface EmailSource {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Email data types from Microsoft Graph API
 */
export interface GraphEmail {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients?: {
    emailAddress: {
      name: string;
      address: string;
    };
  }[];
  receivedDateTime: string;
  body?: {
    contentType: string;
    content: string;
  };
  hasAttachments?: boolean;
  importance?: 'low' | 'normal' | 'high';
}

export interface GraphEmailListResponse {
  value: GraphEmail[];
  '@odata.nextLink'?: string;
}

// Re-export toolRegistry from tools.ts for convenience
export { toolRegistry } from './tools';
