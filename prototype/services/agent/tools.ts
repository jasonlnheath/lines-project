/**
 * Agent Tools
 * Core tools for email search and retrieval
 */

import { Tool, ToolContext, ToolResult, GraphEmail } from './types';
import { graphEndpoints } from '../msalConfig';

/**
 * Read tool - Fetch full email content by ID
 */
export const readTool: Tool = {
  name: 'read',
  description: 'Read the full content of a specific email including body, headers, and metadata. Use this when the user asks about a specific email or needs to see the complete message.',
  inputSchema: {
    type: 'object',
    properties: {
      emailId: {
        type: 'string',
        description: 'The unique ID of the email to read',
      },
    },
    required: ['emailId'],
  },
  handler: async ({ emailId }, context): Promise<ToolResult> => {
    try {
      const response = await fetch(`${graphEndpoints.messages}/${emailId}?$select=id,subject,from,toRecipients,receivedDateTime,body,hasAttachments,importance`, {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
          Prefer: 'outlook.body-content-type="text"',
        },
      });

      if (!response.ok) {
        return { success: false, error: `Failed to read email: ${response.statusText}` };
      }

      const email: GraphEmail = await response.json();

      // Extract text from HTML body
      let bodyText = email.body?.content || '';
      if (email.body?.contentType === 'html') {
        bodyText = htmlToText(bodyText);
      }

      return {
        success: true,
        data: {
          id: email.id,
          subject: email.subject,
          from: `${email.from.emailAddress.name} <${email.from.emailAddress.address}>`,
          to: email.toRecipients?.map(r => `${r.emailAddress.name} <${r.emailAddress.address}>`).join(', ') || '',
          date: email.receivedDateTime,
          body: bodyText,
          hasAttachments: email.hasAttachments,
          importance: email.importance,
        },
      };
    } catch (error) {
      return { success: false, error: `Error reading email: ${error}` };
    }
  },
};

/**
 * Grep tool - Search across email content for patterns
 */
export const grepTool: Tool = {
  name: 'grep',
  description: 'Search across emails using regex patterns. Returns matching emails with context snippets. Use this for finding emails containing specific text, phrases, or patterns.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The search pattern or keyword to find in emails',
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Whether the search should be case sensitive (default: false)',
        enum: ['true', 'false'],
      },
      limit: {
        type: 'string',
        description: 'Maximum number of results to return (default: 10)',
      },
    },
    required: ['pattern'],
  },
  handler: async ({ pattern, caseSensitive = 'false', limit = '10' }, context): Promise<ToolResult> => {
    try {
      // Use $search for content search in Graph API
      const searchQuery = caseSensitive === 'true' ? `"${pattern}"` : `"${pattern}"`;
      const response = await fetch(`${graphEndpoints.messages}?$search=${encodeURIComponent(searchQuery)}&$top=${limit}&$select=id,subject,from,receivedDateTime,body`, {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: `Search failed: ${response.statusText}` };
      }

      const data: { value: GraphEmail[] } = await response.json();
      const emails = data.value || [];

      return {
        success: true,
        data: {
          pattern,
          count: emails.length,
          matches: emails.map(email => ({
            id: email.id,
            subject: email.subject,
            from: `${email.from.emailAddress.name} <${email.from.emailAddress.address}>`,
            date: email.receivedDateTime,
            snippet: email.body?.content?.substring(0, 200) || '',
          })),
        },
      };
    } catch (error) {
      return { success: false, error: `Error searching emails: ${error}` };
    }
  },
};

/**
 * Glob tool - Match subject lines and attachment filenames with wildcards
 */
export const globTool: Tool = {
  name: 'glob',
  description: 'Find emails by subject line or attachment filename patterns. Supports wildcards (*, ?, []). Use this when looking for emails with specific subject patterns or attachment types.',
  inputSchema: {
    type: 'object',
    properties: {
      subjectPattern: {
        type: 'string',
        description: 'Wildcard pattern for matching email subjects (e.g., "*invoice*", "report-2024-*")',
      },
      filenamePattern: {
        type: 'string',
        description: 'Wildcard pattern for matching attachment filenames (e.g., "*.pdf", "report-*.xlsx")',
      },
      limit: {
        type: 'string',
        description: 'Maximum number of results to return (default: 10)',
      },
    },
    required: [],
  },
  handler: async ({ subjectPattern, filenamePattern, limit = '10' }, context): Promise<ToolResult> => {
    try {
      if (!subjectPattern && !filenamePattern) {
        return { success: false, error: 'Either subjectPattern or filenamePattern is required' };
      }

      // If searching for attachments, we need to filter for emails with attachments
      let filter = '';
      if (filenamePattern) {
        filter += "hasAttachments eq true";
      }

      const response = await fetch(`${graphEndpoints.messages}?$filter=${encodeURIComponent(filter)}&$top=${limit}&$select=id,subject,from,receivedDateTime,hasAttachments`, {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: `Search failed: ${response.statusText}` };
      }

      const data: { value: GraphEmail[] } = await response.json();
      let emails = data.value || [];

      // Filter by subject pattern if provided
      if (subjectPattern) {
        const regex = globToRegex(subjectPattern);
        emails = emails.filter(e => regex.test(e.subject));
      }

      // Note: For filename filtering, we would need to fetch attachments
      // This is a simplified implementation

      return {
        success: true,
        data: {
          subjectPattern,
          filenamePattern,
          count: emails.length,
          matches: emails.map(email => ({
            id: email.id,
            subject: email.subject,
            from: `${email.from.emailAddress.name} <${email.from.emailAddress.address}>`,
            date: email.receivedDateTime,
            hasAttachments: email.hasAttachments,
          })),
        },
      };
    } catch (error) {
      return { success: false, error: `Error searching emails: ${error}` };
    }
  },
};

/**
 * Fetch tool - Retrieve email threads, messages by date range, or from same sender
 */
export const fetchTool: Tool = {
  name: 'fetch',
  description: 'Retrieve related messages - entire email threads, messages from a date range, or from the same sender. Use this to get context around an email.',
  inputSchema: {
    type: 'object',
    properties: {
      conversationId: {
        type: 'string',
        description: 'The conversation ID to fetch all messages from the same thread',
      },
      sender: {
        type: 'string',
        description: 'Email address to fetch all messages from this sender',
      },
      startDate: {
        type: 'string',
        description: 'Start date for date range filter (ISO 8601 format, e.g., 2024-01-01)',
      },
      endDate: {
        type: 'string',
        description: 'End date for date range filter (ISO 8601 format, e.g., 2024-12-31)',
      },
      limit: {
        type: 'string',
        description: 'Maximum number of results to return (default: 20)',
      },
    },
    required: [],
  },
  handler: async ({ conversationId, sender, startDate, endDate, limit = '20' }, context): Promise<ToolResult> => {
    try {
      let filter = '';

      if (sender) {
        filter += `from/emailAddress/address eq '${sender}'`;
      }

      if (startDate || endDate) {
        if (filter) filter += ' and ';
        filter += `receivedDateTime ge ${startDate || '1970-01-01'}`;
        if (endDate) {
          filter += ` and receivedDateTime le ${endDate}`;
        }
      }

      const url = filter
        ? `${graphEndpoints.messages}?$filter=${encodeURIComponent(filter)}&$top=${limit}&$orderby=receivedDateTime desc`
        : `${graphEndpoints.messages}?$top=${limit}&$orderby=receivedDateTime desc`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: `Fetch failed: ${response.statusText}` };
      }

      const data: { value: GraphEmail[] } = await response.json();
      const emails = data.value || [];

      return {
        success: true,
        data: {
          criteria: { conversationId, sender, startDate, endDate },
          count: emails.length,
          messages: emails.map(email => ({
            id: email.id,
            subject: email.subject,
            from: `${email.from.emailAddress.name} <${email.from.emailAddress.address}>`,
            date: email.receivedDateTime,
          })),
        },
      };
    } catch (error) {
      return { success: false, error: `Error fetching emails: ${error}` };
    }
  },
};

/**
 * Summarize tool - Condense email content using LLM
 */
export const summarizeTool: Tool = {
  name: 'summarize',
  description: 'Summarize email content or threads. Returns condensed bullet points or paragraph summary. Use this when the user wants a quick overview of email content.',
  inputSchema: {
    type: 'object',
    properties: {
      emailId: {
        type: 'string',
        description: 'The email ID to summarize',
      },
      format: {
        type: 'string',
        description: 'Summary format: "bullets" or "paragraph" (default: bullets)',
        enum: ['bullets', 'paragraph'],
      },
      maxLength: {
        type: 'string',
        description: 'Maximum length of summary in words (default: 150)',
      },
    },
    required: ['emailId'],
  },
  handler: async ({ emailId, format = 'bullets', maxLength = '150' }, context): Promise<ToolResult> => {
    try {
      // First fetch the email
      const response = await fetch(`${graphEndpoints.messages}/${emailId}?$select=id,subject,from,body`, {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
          Prefer: 'outlook.body-content-type="text"',
        },
      });

      if (!response.ok) {
        return { success: false, error: `Failed to fetch email for summary: ${response.statusText}` };
      }

      const email: GraphEmail = await response.json();

      let bodyText = email.body?.content || '';
      if (email.body?.contentType === 'html') {
        bodyText = htmlToText(bodyText);
      }

      // Simple extractive summary for prototype
      // In production, use Claude API for abstractive summarization
      const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const keyPoints = sentences.slice(0, 5).map(s => s.trim());

      return {
        success: true,
        data: {
          emailId,
          subject: email.subject,
          summary: format === 'bullets'
            ? keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')
            : keyPoints.join(' '),
          format,
        },
      };
    } catch (error) {
      return { success: false, error: `Error summarizing email: ${error}` };
    }
  },
};

/**
 * Registry of all available tools
 */
export const toolRegistry: Record<string, Tool> = {
  read: readTool,
  grep: grepTool,
  glob: globTool,
  fetch: fetchTool,
  summarize: summarizeTool,
};

/**
 * Helper: Convert HTML to plain text
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper: Convert glob pattern to regex
 */
function globToRegex(glob: string): RegExp {
  const regexString = glob
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(regexString, 'i');
}
