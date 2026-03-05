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
  conversationHistory?: Message[];
  previousToolResults?: Record<string, any>;
}

export interface AgentResponse {
  answer: string;
  toolTrace: ToolTraceEntry[];
  sources?: EmailSource[];
  conversationHistory?: Message[];
  toolResults?: Record<string, any>;
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
 *
 * Microsoft Graph Thread Properties for Deduplication:
 * - conversationId: Groups emails in same thread - PRIMARY KEY for deduplication
 * - conversationIndex: Position within thread (binary, for sorting)
 * - uniqueBody: Only NEW content (excludes quotes/replies!) - AVOID DUPLICATE READING
 * - bodyPreview: First 255 chars, text format - USE FOR PREVIEWS
 * - internetMessageId: RFC2822 message ID - alternative unique identifier
 */
export interface GraphEmail {
  id: string;
  // Microsoft Graph thread properties for deduplication
  conversationId?: string;        // Thread identifier - groups emails in same conversation
  conversationIndex?: string;     // Position in thread (binary, for sorting)
  internetMessageId?: string;     // RFC2822 message ID
  uniqueBody?: {                  // Only new content, excludes quoted replies!
    contentType: string;
    content: string;
  };
  bodyPreview?: string;           // First 255 chars, text format - USE FOR PREVIEWS
  // Standard email properties
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
  body?: {                        // Full body (includes quoted content)
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
