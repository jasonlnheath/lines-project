/**
 * Graph Emails API Route
 * Fetch emails by line ID or individual email ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphStorageManager } from '@/services/graph/storage/graphStorageManager';

/**
 * Decode HTML numeric entities (including emoji codes like &#128077;)
 * This ensures backward compatibility for emails stored before entity decoding was added
 * Uses fromCodePoint for proper emoji handling (surrogate pairs)
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#(\d+);/g, (match, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Process email to decode HTML entities in body
 */
function processEmail(email: any): any {
  if (!email) return email;
  return {
    ...email,
    body: decodeHtmlEntities(email.body || ''),
    subject: decodeHtmlEntities(email.subject || ''),
  };
}

/**
 * GET /api/graph/emails
 * Query params:
 *   - lineId: Get all emails in a line
 *   - emailId: Get a single email by ID
 *   - unlined: Return unlined emails (optional query filter)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lineId = searchParams.get('lineId');
  const emailId = searchParams.get('emailId');
  const unlined = searchParams.get('unlined');
  const query = searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '20');

  // Get user ID from session cookie
  const userInfo = request.cookies.get('user_info')?.value;
  if (!userInfo) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let user;
  try {
    user = JSON.parse(userInfo);
  } catch {
    return NextResponse.json({ error: 'Invalid user session' }, { status: 401 });
  }

  try {
    const manager = new GraphStorageManager(user.id || user.email);

    // Get unlined emails (optionally filtered by query)
    if (unlined) {
      let orphans = await manager.getUnclusteredEmails();

      // Filter by query if provided
      if (query) {
        const queryLower = query.toLowerCase();
        orphans = orphans.filter(email =>
          email.subject?.toLowerCase().includes(queryLower) ||
          email.body?.toLowerCase().includes(queryLower) ||
          email.from?.toLowerCase().includes(queryLower)
        );
      }

      // Apply limit
      orphans = orphans.slice(0, limit);

      // Decode HTML entities for display
      orphans = orphans.map(processEmail);

      console.log('[Graph Emails API] Unlined emails found:', orphans.length);

      return NextResponse.json({
        orphans,
        count: orphans.length,
        query,
      });
    }

    // Get single email by ID
    if (emailId) {
      const email = await manager.getEmail(emailId);
      if (!email) {
        return NextResponse.json({ error: 'Email not found' }, { status: 404 });
      }
      // Decode HTML entities for display
      return NextResponse.json({ email: processEmail(email) });
    }

    // Get emails by line ID
    if (lineId) {
      const emails = await manager.getEmailsInLine(lineId);

      // Debug logging
      console.log('[Graph Emails API] Line ID:', lineId);
      console.log('[Graph Emails API] Email count:', emails.length);

      // Decode HTML entities for display
      const processedEmails = emails.map(processEmail);

      return NextResponse.json({ emails: processedEmails, count: emails.length });
    }

    // No parameters - return error
    return NextResponse.json(
      { error: 'Provide either lineId, emailId, or unlined parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Graph Emails API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
