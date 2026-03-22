/**
 * Lining Validation Test Endpoint
 *
 * Actions:
 *   GET /api/graph/test?action=thread-stats      - Ground truth from Graph
 *   GET /api/graph/test?action=validate-lining   - Line vs thread comparison
 *   GET /api/graph/test?action=full-report       - Both combined (default)
 *   POST /api/graph/test with { action: 'reset-and-validate' } - Clear lines, re-line, validate
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphStorageManager } from '@/services/graph/storage/graphStorageManager';
import { TopicLineService } from '@/services/graph/topicMapping/lineService';
import {
  fetchLast30DaysEmails,
  buildThreadReport,
  validateLines,
} from '@/services/graph/lineTestService';

/**
 * Strip HTML tags and convert to plain text
 * Handles common email HTML structure from Microsoft Graph API
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    // Remove style tags and content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove script tags and content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove head section
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    // Replace br and p tags with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    // Decode HTML numeric entities (including emoji codes like &#128077;)
    // Use fromCodePoint for proper emoji handling (surrogate pairs)
    .replace(/&#(\d+);/g, (match, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    // Decode named HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Remove all other HTML tags
    .replace(/<[^>]+>/g, '')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function getAccessToken(request: NextRequest): Promise<string | null> {
  const refreshData = request.cookies.get('refresh_data')?.value;
  if (!refreshData) return null;
  const { expiresAt } = JSON.parse(refreshData);
  if (Date.now() >= expiresAt - 300000) return null;

  const cookieHeader = request.headers.get('cookie');
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader && { Cookie: cookieHeader }),
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.accessToken || null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'full-report';

    const accessToken = await getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized or token expired' }, { status: 401 });
    }

    const userInfo = request.cookies.get('user_info')?.value;
    if (!userInfo) return NextResponse.json({ error: 'No user session' }, { status: 401 });
    const user = JSON.parse(userInfo);
    const userId = user.id;

    if (action === 'thread-stats') {
      const messages = await fetchLast30DaysEmails(accessToken);
      return NextResponse.json(buildThreadReport(messages));
    }

    const [messages, lines] = await Promise.all([
      fetchLast30DaysEmails(accessToken),
      new GraphStorageManager(userId).getTopicLines(),
    ]);
    const threadStats = buildThreadReport(messages);

    if (action === 'validate-lining') {
      return NextResponse.json(validateLines(threadStats, lines));
    }

    // full-report (default)
    return NextResponse.json({
      threadStats,
      liningValidation: validateLines(threadStats, lines),
    });
  } catch (error) {
    console.error('[test] Error:', error);
    return NextResponse.json({ error: 'Internal server error', message: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/graph/test
 * Actions:
 *   { action: 'reset-and-validate' } - Clear lines, re-line, and validate
 *   { action: 'clear-lines' } - Clear all lines only
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const accessToken = await getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized or token expired' }, { status: 401 });
    }

    const userInfo = request.cookies.get('user_info')?.value;
    if (!userInfo) return NextResponse.json({ error: 'No user session' }, { status: 401 });
    const user = JSON.parse(userInfo);
    const userId = user.id;

    const storage = new GraphStorageManager(userId);

    if (action === 'clear-lines') {
      // Clear all topic lines
      const lines = await storage.getTopicLines();
      for (const line of lines) {
        await storage.deleteTopicLine(line.id);
      }
      return NextResponse.json({
        success: true,
        message: `Cleared ${lines.length} lines`,
      });
    }

    if (action === 'reset-and-validate') {
      // Step 1: Clear existing lines
      const oldLines = await storage.getTopicLines();
      for (const line of oldLines) {
        await storage.deleteTopicLine(line.id);
      }
      console.log(`[test] Cleared ${oldLines.length} existing lines`);

      // Step 1.5: Clear existing email data to fix incorrect folder/direction values
      await storage.clearGraph();
      console.log(`[test] Cleared existing graph data (emails)`);

      // Step 2: Fetch emails from Graph API
      const messages = await fetchLast30DaysEmails(accessToken);
      console.log(`[test] Fetched ${messages.length} emails from Graph`);

      // Debug: Count unique conversationIds
      const uniqueConvIds = new Set(messages.map(m => m.conversationId));
      console.log(`[test] Unique conversationIds: ${uniqueConvIds.size}`);

      // Step 3: Store emails in graph (with all required EmailNode fields)
      // Get user email for direction detection
      const userEmail = (user.email || user.id || '').toLowerCase();
      console.log(`[test] User email for detection: ${userEmail}`);

      const emailNodes = messages.map(msg => {
        const folder = msg._folder || 'inbox';
        const toRecipients = msg.toRecipients?.map(r => r.emailAddress.address) || [];

        // Determine direction by checking if sender is the user (not folder-based)
        // This correctly handles calendar responses that appear in inbox but are FROM the user
        const senderAddress = msg.from.emailAddress.address.toLowerCase();
        const senderName = msg.from.emailAddress.name.toLowerCase();
        const isFromUser = senderAddress === userEmail ||
                          senderName.includes('jason heath') ||
                          senderAddress.includes('jheath@');

        return {
          id: msg.id,
          subject: msg.subject,
          from: msg.from.emailAddress.address,
          to: toRecipients,
          date: msg.receivedDateTime || msg.sentDateTime || new Date().toISOString(),
          conversationId: msg.conversationId,
          body: stripHtml(msg.body?.content || ''),
          bodyPreview: msg.bodyPreview || '',
          importance: 'normal' as const,
          hasAttachments: false,
          topics: [],
          keywords: [],
          entities: [],
          // Folder and direction tracking
          folder: folder as 'inbox' | 'sentItems' | 'archive' | 'drafts' | 'other',
          isSent: isFromUser,  // Use sender-based detection
          direction: (isFromUser ? 'outgoing' : 'incoming') as 'incoming' | 'outgoing',
          // Metadata
          indexedAt: Date.now(),
          lastAccessed: Date.now(),
          accessCount: 0,
        };
      });

      // Deduplicate truly identical emails (same sender + date + subject)
      // Microsoft Graph may return the same email with different IDs from different folders
      // We use sender + date + subject to identify truly identical emails
      // Different emails in same conversation (replies) will have different dates or senders
      const uniqueNodes = new Map<string, typeof emailNodes[0]>();
      for (const node of emailNodes) {
        // Use sender + exact timestamp + subject (first 50 chars) as content key
        // This deduplicates same email in different folders but preserves different emails in thread
        const contentKey = `${node.from}|${node.date}|${node.subject.substring(0, 50)}`;

        // Prefer outgoing version when both incoming and outgoing exist
        const existing = uniqueNodes.get(contentKey);
        if (!existing) {
          uniqueNodes.set(contentKey, node);
        } else if (node.direction === 'outgoing' && existing.direction === 'incoming') {
          // Replace incoming with outgoing (keeps the sent version)
          uniqueNodes.set(contentKey, node);
        }
        // Otherwise keep existing
      }
      const dedupedNodes = Array.from(uniqueNodes.values());

      if (emailNodes.length !== dedupedNodes.length) {
        console.log(`[test] Deduplicated ${emailNodes.length} emails to ${dedupedNodes.length} unique emails`);
      }

      const outgoingCount = dedupedNodes.filter(e => e.direction === 'outgoing').length;
      console.log(`[test] Emails to store: ${dedupedNodes.length} total, ${outgoingCount} outgoing, ${dedupedNodes.length - outgoingCount} incoming`);

      await storage.addEmails(dedupedNodes);
      console.log(`[test] Added ${dedupedNodes.length} emails to storage`);

      // Step 4: Run lining
      const lineService = new TopicLineService();
      const unlinedEmails = await storage.getUnclusteredEmails();
      console.log(`[test] Unlined emails: ${unlinedEmails.length}`);

      // Debug: Check conversationIds in unlined emails
      const unlinedConvIds = new Set(unlinedEmails.map(e => e.conversationId));
      console.log(`[test] Unique conversationIds in unlined: ${unlinedConvIds.size}`);

      const newLines = await lineService.clusterEmails(unlinedEmails, 0.65, []);
      console.log(`[test] Lining service returned ${newLines.length} lines`);

      // Step 5: Save new lines
      for (const line of newLines) {
        await storage.saveTopicLine(line);
      }
      console.log(`[test] Saved ${newLines.length} new lines`);

      // Step 6: Validate
      const threadStats = buildThreadReport(messages);
      const allLines = await storage.getTopicLines();
      console.log(`[test] Total lines in storage: ${allLines.length}`);
      const validation = validateLines(threadStats, allLines);

      return NextResponse.json({
        success: true,
        steps: {
          clearedLines: oldLines.length,
          fetchedEmails: messages.length,
          uniqueConversationIds: uniqueConvIds.size,
          unlinedEmails: unlinedEmails.length,
          unlinedConvIds: unlinedConvIds.size,
          createdLines: newLines.length,
          finalLineCount: allLines.length,
        },
        validation,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action', message: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('[test] POST error:', error);
    return NextResponse.json({ error: 'Internal server error', message: String(error) }, { status: 500 });
  }
}
