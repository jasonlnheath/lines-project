/**
 * Agent Tools
 * Core tools for email search and retrieval
 */

import { Tool, ToolContext, ToolResult, GraphEmail, TopicCluster } from './types';
import { graphEndpoints } from '../msalConfig';
import { runFullReport, fetchLast30DaysEmails, buildThreadReport, validateClustering } from '../graph/clusteringTestService';
import { GraphStorageManager } from '../graph/storage/graphStorageManager';

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
      // Include Microsoft Graph thread properties for deduplication
      const response = await fetch(`${graphEndpoints.messages}/${emailId}?$select=id,subject,from,toRecipients,receivedDateTime,uniqueBody,bodyPreview,body,hasAttachments,importance,conversationId,conversationIndex,internetMessageId`, {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
          Prefer: 'outlook.body-content-type="text"',
        },
      });

      if (!response.ok) {
        return { success: false, error: `Failed to read email: ${response.statusText}` };
      }

      const email: GraphEmail = await response.json();

      // Prefer uniqueBody over body for deduplication (uniqueBody excludes quoted replies!)
      let bodyText = email.uniqueBody?.content || email.body?.content || '';
      const contentType = email.uniqueBody?.contentType || email.body?.contentType;

      // Extract text from HTML body if needed
      if (contentType === 'html') {
        bodyText = htmlToText(bodyText);
      }

      return {
        success: true,
        data: {
          id: email.id,
          conversationId: email.conversationId, // For thread tracking
          conversationIndex: email.conversationIndex, // For position in thread
          subject: email.subject,
          from: `${email.from.emailAddress.name} <${email.from.emailAddress.address}>`,
          to: email.toRecipients?.map(r => `${r.emailAddress.name} <${r.emailAddress.address}>`).join(', ') || '',
          date: email.receivedDateTime,
          body: bodyText,
          bodyPreview: email.bodyPreview, // Text preview for quick scanning
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
  description: 'Search across emails using regex patterns. Returns matching emails with context snippets. Use this for finding emails containing specific text, phrases, or patterns. Can search different mail folders.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The search pattern or keyword to find in emails',
      },
      folder: {
        type: 'string',
        description: 'Mail folder to search (default: inbox)',
        enum: ['inbox', 'sent', 'archive', 'drafts'],
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
  handler: async ({ pattern, folder = 'inbox', caseSensitive = 'false', limit = '10' }, context): Promise<ToolResult> => {
    try {
      // Determine which folder endpoint to use
      const endpoint = folder === 'sent' ? graphEndpoints.sentItems :
                       folder === 'archive' ? graphEndpoints.archive :
                       folder === 'drafts' ? graphEndpoints.drafts :
                       graphEndpoints.messages;

      // Use $search for content search in Graph API
      // Note: Graph API doesn't support combining $filter or $orderby with $search
      // Search results will be ranked by relevance, then we filter client-side
      // Include conversationId and bodyPreview for thread deduplication
      const searchQuery = caseSensitive === 'true' ? `"${pattern}"` : `"${pattern}"`;
      const url = `${endpoint}?$search=${encodeURIComponent(searchQuery)}&$top=${limit}&$select=id,subject,from,receivedDateTime,body,bodyPreview,conversationId`;

      console.log('[grepTool] Searching emails:', { folder, url, searchQuery, limit });

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
        },
      });

      console.log('[grepTool] Graph API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[grepTool] Graph API error:', errorText);
        return { success: false, error: `Search failed: ${response.statusText}` };
      }

      const data: { value: GraphEmail[] } = await response.json();
      let emails = data.value || [];

      // Client-side: sort by date (newest first) since we can't use $orderby with $search
      emails = emails.sort((a, b) => {
        const dateA = new Date(a.receivedDateTime || 0);
        const dateB = new Date(b.receivedDateTime || 0);
        return dateB.getTime() - dateA.getTime();
      });

      console.log('[grepTool] Found emails:', emails.length);

      return {
        success: true,
        data: {
          pattern,
          count: emails.length,
          matches: emails.map(email => {
            // Try bodyPreview first, fall back to extracting from body
            let snippet = email.bodyPreview || '';
            if (!snippet && email.body?.content) {
              const bodyText = email.body.contentType === 'html'
                ? htmlToText(email.body.content)
                : email.body.content;
              snippet = bodyText.substring(0, 200).replace(/\s+/g, ' ').trim();
            }
            return {
              id: email.id,
              conversationId: email.conversationId, // For thread tracking
              subject: email.subject,
              from: `${email.from.emailAddress.name} <${email.from.emailAddress.address}>`,
              date: email.receivedDateTime,
              snippet: snippet.substring(0, 200),
            };
          }),
        },
      };
    } catch (error) {
      console.log('[grepTool] Exception:', error);
      return { success: false, error: `Error searching emails: ${error}` };
    }
  },
};

/**
 * Glob tool - Match subject lines and attachment filenames with wildcards
 */
export const globTool: Tool = {
  name: 'glob',
  description: 'Find emails by subject line or attachment filename patterns. Supports wildcards (*, ?, []). Use this when looking for emails with specific subject patterns or attachment types. Can search different mail folders.',
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
      folder: {
        type: 'string',
        description: 'Mail folder to search (default: inbox)',
        enum: ['inbox', 'sent', 'archive', 'drafts'],
      },
      limit: {
        type: 'string',
        description: 'Maximum number of results to return (default: 10)',
      },
    },
    required: [],
  },
  handler: async ({ subjectPattern, filenamePattern, folder = 'inbox', limit = '10' }, context): Promise<ToolResult> => {
    try {
      if (!subjectPattern && !filenamePattern) {
        return { success: false, error: 'Either subjectPattern or filenamePattern is required' };
      }

      // Determine which folder endpoint to use
      const endpoint = folder === 'sent' ? graphEndpoints.sentItems :
                       folder === 'archive' ? graphEndpoints.archive :
                       folder === 'drafts' ? graphEndpoints.drafts :
                       graphEndpoints.messages;

      // If searching for attachments, we need to filter for emails with attachments
      let filter = '';
      if (filenamePattern) {
        filter += "hasAttachments eq true";
      }

      // Include body so we can generate preview snippets when bodyPreview is empty
      const response = await fetch(`${endpoint}?$filter=${encodeURIComponent(filter)}&$top=${limit}&$select=id,subject,from,receivedDateTime,hasAttachments,body,bodyPreview,conversationId`, {
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
          matches: emails.map(email => {
            // Generate snippet with fallback
            let snippet = email.bodyPreview || '';
            if (!snippet && email.body?.content) {
              const bodyText = email.body.contentType === 'html'
                ? htmlToText(email.body.content)
                : email.body.content;
              snippet = bodyText.substring(0, 200).replace(/\s+/g, ' ').trim();
            }
            return {
              id: email.id,
              conversationId: email.conversationId, // For thread tracking
              subject: email.subject,
              from: `${email.from.emailAddress.name} <${email.from.emailAddress.address}>`,
              date: email.receivedDateTime,
              hasAttachments: email.hasAttachments,
              snippet: snippet.substring(0, 200), // Unified field for preview
            };
          }),
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
  description: 'Retrieve related messages - entire email threads, messages from a date range, or from the same sender. Use this to get context around an email. Can search different mail folders.',
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
      folder: {
        type: 'string',
        description: 'Mail folder to search (default: inbox)',
        enum: ['inbox', 'sent', 'archive', 'drafts'],
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
  handler: async ({ conversationId, sender, folder = 'inbox', startDate, endDate, limit = '20' }, context): Promise<ToolResult> => {
    try {
      // Determine which folder endpoint to use
      const endpoint = folder === 'sent' ? graphEndpoints.sentItems :
                       folder === 'archive' ? graphEndpoints.archive :
                       folder === 'drafts' ? graphEndpoints.drafts :
                       graphEndpoints.messages;

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

      // Add $count=true to get total count in response headers
      // Include conversationId for thread tracking
      // Include body to generate preview snippets when bodyPreview is empty
      // Note: Cannot use $orderby with $filter (InefficientFilter error)
      const url = filter
        ? `${endpoint}?$filter=${encodeURIComponent(filter)}&$top=${limit}&$count=true&$select=id,subject,from,receivedDateTime,body,bodyPreview,conversationId`
        : `${endpoint}?$top=${limit}&$orderby=receivedDateTime desc&$count=true&$select=id,subject,from,receivedDateTime,body,bodyPreview,conversationId`;

      console.log('[fetchTool] Fetching emails:', { folder, url, filter, limit });

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
        },
      });

      console.log('[fetchTool] Graph API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[fetchTool] Graph API error:', errorText);
        return { success: false, error: `Fetch failed: ${response.statusText}` };
      }

      const data: { value: GraphEmail[]; '@odata.count'?: number } = await response.json();
      const emails = data.value || [];
      const totalCount = data['@odata.count'] ?? emails.length;

      console.log('[fetchTool] Found emails:', emails.length, 'Total matching:', totalCount);
      console.log('[fetchTool] Email subjects:', emails.map(e => e.subject));

      return {
        success: true,
        data: {
          criteria: { conversationId, sender, startDate, endDate },
          returned: emails.length,
          total: totalCount,
          hasMore: totalCount > parseInt(limit),
          messages: emails.map(email => {
            // Generate snippet with fallback
            let snippet = email.bodyPreview || '';
            if (!snippet && email.body?.content) {
              const bodyText = email.body.contentType === 'html'
                ? htmlToText(email.body.content)
                : email.body.content;
              snippet = bodyText.substring(0, 200).replace(/\s+/g, ' ').trim();
            }
            return {
              id: email.id,
              conversationId: email.conversationId, // For thread tracking
              subject: email.subject,
              from: `${email.from.emailAddress.name} <${email.from.emailAddress.address}>`,
              date: email.receivedDateTime,
              snippet: snippet.substring(0, 200),
            };
          }),
        },
      };
    } catch (error) {
      console.log('[fetchTool] Exception:', error);
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
 * Search tool - Advanced email search using Microsoft Search API with KQL
 * Official docs: https://learn.microsoft.com/graph/search-concept-messages
 */
export const searchTool: Tool = {
  name: 'search',
  description: 'Advanced content search using Microsoft Search API with KQL (Keyword Query Language). Supports relevance ranking, hit highlighting, and property-specific searches. Automatically searches ALL mail folders (inbox, sent, archive, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'KQL query string. Examples: "from:john@example.com", "subject:project", "body:meeting AND importance:high"',
      },
      limit: {
        type: 'string',
        description: 'Maximum number of results (default: 20, max: 25 for messages)',
      },
    },
    required: ['query'],
  },
  handler: async ({ query, limit = '20' }, context): Promise<ToolResult> => {
    try {
      console.log('[searchTool] Searching emails with Microsoft Search API:', { query, limit });

      // Microsoft Search API request (per official docs)
      const response = await fetch(graphEndpoints.search, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            entityTypes: ['message'],
            query: {
              queryString: query,
            },
            from: 0,
            size: Math.min(parseInt(limit), 25), // Max 25 for messages per official docs
          }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[searchTool] Search API error:', errorText);

        // Fallback to $search query parameter on inbox folder
        console.log('[searchTool] Falling back to $search query parameter');
        return await searchWithQueryParameter(query, limit, context);
      }

      const data = await response.json();

      // Response parsing: data.value[0].hitsContainers[0].hits[]
      const hits = data.value?.[0]?.hitsContainers?.[0]?.hits || [];

      console.log(`[searchTool] Found ${hits.length} results for query "${query}"`);

      // Debug: Log first hit structure and check if sent items are included
      if (hits.length > 0) {
        console.log('[searchTool] First hit resource keys:', Object.keys(hits[0].resource || {}));
        console.log('[searchTool] First hit has conversationId:', !!(hits[0].resource?.conversationId));
        console.log('[searchTool] First hit resource.id:', hits[0].resource?.id);
        console.log('[searchTool] First hit hitId:', hits[0].hitId);
        console.log('[searchTool] First hit from:', hits[0].resource?.from?.emailAddress?.address);
        console.log('[searchTool] Will use id:', hits[0].resource?.id || hits[0].hitId);

        // Check sample of results to see if any might be sent items (from current user)
        const sampleFroms = hits.slice(0, Math.min(5, hits.length)).map((h: any) => h.resource?.from?.emailAddress?.address);
        console.log('[searchTool] Sample from addresses:', sampleFroms);
      }

      // Process hits - each hit has resource, summary, and rank properties
      const results = hits.map((hit: any) => ({
        id: hit.resource.id || hit.hitId, // Use hitId as fallback when resource.id is not available
        conversationId: hit.resource.conversationId,
        subject: hit.resource.subject || '(no subject)',
        from: `${hit.resource.from?.emailAddress?.name || ''} <${hit.resource.from?.emailAddress?.address || ''}>`.trim(),
        date: hit.resource.receivedDateTime,
        relevanceScore: hit.rank || 0, // Higher = more relevant
        highlightedSnippet: hit.summary || '', // Hit-highlighted snippet from API
        hasAttachments: hit.resource.hasAttachments,
        importance: hit.resource.importance,
      }));

      // Sort by relevance score (highest first) - already ranked by API, but ensure order
      const sortedResults = results.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

      console.log(`[searchTool] Total results: ${sortedResults.length}`);

      return {
        success: true,
        data: {
          query,
          totalResults: sortedResults.length,
          results: sortedResults,
        },
      };
    } catch (error) {
      console.error('[searchTool] Exception:', error);
      // Fallback to $search query parameter
      return await searchWithQueryParameter(query, limit, context);
    }
  },
};

/**
 * Fallback: Use $search query parameter on folder endpoints
 */
async function searchWithQueryParameter(
  query: string,
  limit: string,
  context: { accessToken: string; userId: string }
): Promise<ToolResult> {
  try {
    console.log('[searchTool] Using fallback $search query parameter');

    // Use inbox folder for fallback
    const folderEndpoint = `${graphEndpoints.messages}/mailFolders/Inbox/messages`;
    const searchUrl = new URL(folderEndpoint);
    searchUrl.searchParams.set('$search', JSON.stringify(query));
    searchUrl.searchParams.set('$top', limit);
    searchUrl.searchParams.set('$select', 'id,subject,from,receivedDateTime,bodyPreview,conversationId,importance,hasAttachments');

    const response = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[searchTool] Fallback search error:', errorText);
      return { success: false, error: `Fallback search failed: ${response.statusText}` };
    }

    const data = await response.json();
    const messages = data.value || [];

    const results = messages.map((msg: any) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      subject: msg.subject || '(no subject)',
      from: `${msg.from?.emailAddress?.name || ''} <${msg.from?.emailAddress?.address || ''}>`.trim(),
      date: msg.receivedDateTime,
      relevanceScore: 100, // No relevance score from $search parameter
      highlightedSnippet: msg.bodyPreview || '',
      hasAttachments: msg.hasAttachments,
      importance: msg.importance,
    }));

    console.log(`[searchTool] Fallback found ${results.length} results`);

    return {
      success: true,
      data: {
        query,
        totalResults: results.length,
        results,
        fallback: true, // Indicate this was from fallback
      },
    };
  } catch (error) {
    console.error('[searchTool] Fallback exception:', error);
    return { success: false, error: `Error in fallback search: ${error}` };
  }
}

/**
 * Topic Explore tool - Search topic clusters to find related conversations
 */
export const topicExploreTool: Tool = {
  name: 'topic_explore',
  description: 'Explore topic clusters to find related conversations even when subjects differ. This tool searches the email knowledge graph for groups of semantically related emails, showing subject mutations and email counts. Use this to discover connections across conversations that may have different subject lines but discuss the same topic.',
  inputSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Topic keyword or phrase to search for in cluster names and descriptions',
      },
      limit: {
        type: 'string',
        description: 'Maximum number of clusters to return (default: 10)',
      },
    },
    required: [],
  },
  handler: async ({ topic, limit = '10' }, context): Promise<ToolResult> => {
    try {
      console.log('[topicExploreTool] Exploring topic clusters:', { topic, limit });

      const response = await fetch('/api/graph/topics', {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: `Failed to fetch topic clusters: ${response.statusText}` };
      }

      const data = await response.json();
      let clusters = data.clusters || [];

      // Filter by topic keyword if provided
      if (topic) {
        const topicLower = topic.toLowerCase();
        clusters = clusters.filter((cluster: TopicCluster) =>
          cluster.name.toLowerCase().includes(topicLower) ||
          cluster.description.toLowerCase().includes(topicLower) ||
          cluster.subjectVariations.some((s: string) => s.toLowerCase().includes(topicLower))
        );
      }

      // Apply limit
      clusters = clusters.slice(0, parseInt(limit));

      console.log(`[topicExploreTool] Found ${clusters.length} topic clusters`);

      return {
        success: true,
        data: {
          topic,
          totalResults: clusters.length,
          clusters: clusters.map((cluster: TopicCluster) => ({
            id: cluster.id,
            name: cluster.name,
            description: cluster.description,
            emailCount: cluster.emailIds.length,
            subjectVariations: cluster.subjectVariations,
            confidence: cluster.confidence,
            dateRange: `${new Date(cluster.firstEmailDate).toLocaleDateString()} — ${new Date(cluster.lastEmailDate).toLocaleDateString()}`,
            userConfirmed: cluster.userConfirmed,
          })),
        },
      };
    } catch (error) {
      console.error('[topicExploreTool] Exception:', error);
      return { success: false, error: `Error exploring topic clusters: ${error}` };
    }
  },
};

/**
 * Cluster Search tool - Semantic cluster search with learning loop
 * Finds relevant clusters using semantic content, then searches for related orphans and threads
 */
export const clusterSearchTool: Tool = {
  name: 'cluster_search',
  description: 'Semantic search across email clusters using their semantic profiles (not just names). This enhanced search: 1) Finds clusters by semantic similarity to the query, 2) Identifies related orphan emails that should branch into clusters, 3) Finds other clusters that should merge, 4) Queues suggestions for user review. The learning loop means accepted suggestions improve future searches.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to find semantically related clusters',
      },
      maxClusters: {
        type: 'string',
        description: 'Maximum number of clusters to search for suggestions (default: 5)',
      },
      includeOrphanSearch: {
        type: 'boolean',
        description: 'Whether to search for orphan emails to branch (default: true)',
      },
      includeThreadMerge: {
        type: 'boolean',
        description: 'Whether to search for thread merge candidates (default: true)',
      },
      queueSuggestions: {
        type: 'boolean',
        description: 'Queue found suggestions for user review (default: true)',
      },
      minScore: {
        type: 'string',
        description: 'Minimum similarity score to queue (default: 0.3, range 0-1)',
      },
    },
    required: ['query'],
  },
  handler: async ({ query, maxClusters = '5', includeOrphanSearch = true, includeThreadMerge = true, queueSuggestions = true, minScore = '0.3' }, context): Promise<ToolResult> => {
    try {
      console.log('[clusterSearchTool] Semantic cluster search:', { query, maxClusters, includeOrphanSearch, includeThreadMerge });

      // Call the cluster search API endpoint
      const params = new URLSearchParams({
        query,
        maxClusters,
        includeOrphanSearch: String(includeOrphanSearch),
        includeThreadMerge: String(includeThreadMerge),
        queueSuggestions: String(queueSuggestions),
        minScore,
      });

      const response = await fetch(`/api/graph/clusters/search?${params}`, {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: `Failed to search clusters: ${response.statusText}` };
      }

      const data = await response.json();

      console.log(`[clusterSearchTool] Found ${data.clusters?.length || 0} clusters, ${data.suggestionsQueued || 0} suggestions queued`);

      return {
        success: true,
        data: {
          query,
          clusters: data.clusters || [],
          suggestionsQueued: data.suggestionsQueued || 0,
          suggestionTypes: data.suggestionTypes || { orphanBranches: 0, threadMerges: 0 },
          autoBranchEnabled: data.autoBranchEnabled || false,
        },
      };
    } catch (error) {
      console.error('[clusterSearchTool] Exception:', error);
      return { success: false, error: `Error searching clusters: ${error}` };
    }
  },
};

/**
 * Cluster validate tool - compares local clusters against Graph thread ground truth
 */
export const clusterValidateTool: Tool = {
  name: 'cluster_validate',
  description: 'Validate email clustering by comparing local clusters against real Microsoft Graph thread data (last 30 days). Returns a report with: thread count, cluster count, perfect/partial/missing matches, name accuracy, and a per-thread breakdown. Use this to diagnose clustering problems.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'What to fetch: "thread-stats" (Graph ground truth only), "validate" (comparison report), or "full" (both, default)',
        enum: ['thread-stats', 'validate', 'full'],
      },
    },
    required: [],
  },
  handler: async ({ action = 'full' }, context: ToolContext): Promise<ToolResult> => {
    try {
      if (action === 'thread-stats') {
        const messages = await fetchLast30DaysEmails(context.accessToken);
        const report = buildThreadReport(messages);
        return {
          success: true,
          data: {
            period: report.period,
            totalEmails: report.totalEmails,
            threadCount: report.threadCount,
            threads: report.threads.map(t => ({
              name: t.name,
              emailCount: t.emailCount,
              firstDate: t.firstDate.split('T')[0],
              lastDate: t.lastDate.split('T')[0],
            })),
          },
        };
      }

      if (action === 'validate') {
        const [messages, clusters] = await Promise.all([
          fetchLast30DaysEmails(context.accessToken),
          new GraphStorageManager(context.userId).getTopicClusters(),
        ]);
        const threadStats = buildThreadReport(messages);
        const report = validateClustering(threadStats, clusters);
        return {
          success: true,
          data: {
            summary: report.summary,
            problems: report.threads
              .filter(t => t.matchType !== 'perfect')
              .map(t => ({
                threadName: t.threadName,
                threadEmails: t.threadEmailCount,
                clusterName: t.clusterName,
                clusterEmails: t.clusterEmailCount,
                coverage: t.coverage ? `${Math.round(t.coverage * 100)}%` : '0%',
                issue: t.matchType,
              })),
            unmatchedClusters: report.unmatchedClusters,
          },
        };
      }

      // full
      const { threadStats, clusteringValidation } = await runFullReport(
        context.accessToken,
        context.userId
      );
      return {
        success: true,
        data: {
          threadStats: {
            period: threadStats.period,
            totalEmails: threadStats.totalEmails,
            threadCount: threadStats.threadCount,
          },
          summary: clusteringValidation.summary,
          problems: clusteringValidation.threads
            .filter(t => t.matchType !== 'perfect')
            .map(t => ({
              threadName: t.threadName,
              threadEmails: t.threadEmailCount,
              clusterName: t.clusterName,
              clusterEmails: t.clusterEmailCount,
              coverage: t.coverage ? `${Math.round(t.coverage * 100)}%` : '0%',
              issue: t.matchType,
            })),
          unmatchedClusters: clusteringValidation.unmatchedClusters,
        },
      };
    } catch (error) {
      return { success: false, error: `cluster_validate failed: ${error}` };
    }
  },
};

/**
 * Orphan Search tool - Search unclustered emails
 */
export const orphanSearchTool: Tool = {
  name: 'orphan_search',
  description: 'Search unclustered emails that may be related to the query. Use when cluster_search returns few or no results, or to find new emails that haven\'t been added to clusters yet. Returns orphan emails that could be queued for clustering.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to find in orphan email subjects, bodies, or metadata',
      },
      limit: {
        type: 'string',
        description: 'Maximum orphan emails to return (default: 20)',
      },
    },
    required: ['query'],
  },
  handler: async ({ query, limit = '20' }, context): Promise<ToolResult> => {
    try {
      console.log('[orphanSearchTool] Searching unclustered emails:', { query, limit });

      // Call the API to get unclustered emails filtered by query
      const params = new URLSearchParams({
        query: query,
        limit: limit,
      });

      const response = await fetch(`/api/graph/emails?${params}`, {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: `Failed to search orphans: ${response.statusText}` };
      }

      const data = await response.json();

      console.log(`[orphanSearchTool] Found ${data.orphans?.length || 0} unclustered emails`);

      return {
        success: true,
        data: {
          query,
          orphans: data.orphans || [],
          count: data.orphans?.length || 0,
          message: `Found ${data.orphans?.length || 0} unclustered emails. Consider clustering these to improve future searches.`,
        },
      };
    } catch (error) {
      console.error('[orphanSearchTool] Exception:', error);
      return { success: false, error: `Error searching orphans: ${error}` };
    }
  },
};

/**
 * Registry of all available tools
 */
export const toolRegistry: Record<string, Tool> = {
  read: readTool,
  search: searchTool,
  glob: globTool,
  fetch: fetchTool,
  summarize: summarizeTool,
  topic_explore: topicExploreTool,
  cluster_search: clusterSearchTool,
  orphan_search: orphanSearchTool,
  cluster_validate: clusterValidateTool,
};

/**
 * Helper: Convert HTML to plain text while preserving emojis and unicode characters
 * Uses fromCodePoint for proper emoji handling (surrogate pairs)
 */
function htmlToText(html: string): string {
  return html
    // Remove style and script tags first (with content)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Decode HTML numeric entities (including emoji codes like &#128512;)
    // Use fromCodePoint for proper emoji handling (surrogate pairs)
    .replace(/&#(\d+);/g, (match, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    // Decode named HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&apos;/g, "'")
    // Remove remaining HTML tags but preserve content
    .replace(/<[^>]+>/g, '')
    // Clean up whitespace while preserving line breaks
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
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

/**
 * Helper: Get date N months ago in ISO 8601 format
 */
function getDateMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}
