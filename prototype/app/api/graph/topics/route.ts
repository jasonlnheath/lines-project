/**
 * Topics API Endpoint
 *
 * CRUD operations for topic lines in the email knowledge graph.
 *
 * Endpoints:
 * GET  /api/graph/topics - Get all topic lines
 * GET  /api/graph/topics/[id] - Get specific topic line
 * POST /api/graph/topics/line - Trigger lining on unlined emails
 * DELETE /api/graph/topics/[id] - Delete a topic line
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphStorageManager } from '@/services/graph/storage/graphStorageManager';
import { TopicLineService } from '@/services/graph/topicMapping/lineService';
import { TopicLine } from '@/services/graph/types';
import { getUserIdFromRequest } from '../utils';

/**
 * GET /api/graph/topics
 * Returns all topic lines for current user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const storage = new GraphStorageManager(userId);
    const lines = await storage.getTopicLines();

    return NextResponse.json({
      lines,
      count: lines.length,
    });
  } catch (error) {
    console.error('[API /api/graph/topics] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/graph/topics
 * Create or update topic lines
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'line') {
      // Trigger lining on unlined emails
      return await handleLining(userId, body);
    } else if (action === 'progress') {
      // Get lining progress status
      return await handleProgress(userId);
    } else if (action === 'create') {
      // Create a new line manually
      return await handleCreateLine(userId, body);
    } else if (action === 'update') {
      // Update an existing line
      return await handleUpdateLine(userId, body);
    } else {
      return NextResponse.json(
        { error: 'Invalid action', message: `Unknown action: ${action}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API /api/graph/topics] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/graph/topics/[id]
 * Delete a specific topic line
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: lineId } = await params;

    if (!lineId) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Line ID is required' },
        { status: 400 }
      );
    }

    const storage = new GraphStorageManager(userId);
    await storage.deleteTopicLine(lineId);

    return NextResponse.json({
      success: true,
      message: `Line ${lineId} deleted`,
    });
  } catch (error) {
    console.error('[API /api/graph/topics] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Handle progress request
 * Returns lining status and statistics
 */
async function handleProgress(userId: string) {
  const storage = new GraphStorageManager(userId);

  try {
    const lines = await storage.getTopicLines();
    const emails = await storage.getAllEmails();

    let oldestDate: string | null = null;
    const linedIds = new Set<string>();

    for (const line of lines) {
      for (const emailId of line.emailIds) {
        linedIds.add(emailId);
      }
      if (!oldestDate || line.firstEmailDate < oldestDate) {
        oldestDate = line.firstEmailDate;
      }
    }

    return NextResponse.json({
      emailCount: emails.length,
      lineCount: lines.length,
      linedEmails: linedIds.size,
      oldestLinedDate: oldestDate,
    });
  } catch (error) {
    console.error('[API /api/graph/topics] Progress error:', error);
    return NextResponse.json({
      emailCount: 0,
      lineCount: 0,
      linedEmails: 0,
      oldestLinedDate: null,
    });
  }
}

/**
 * Handle lining action
 * Lines unlined emails using thread-first approach
 */
async function handleLining(userId: string, body: any) {
  const { threshold, limit, startDate, endDate } = body;

  const storage = new GraphStorageManager(userId);
  const lineService = new TopicLineService();

  // Get unlined emails
  let unlinedEmails = await storage.getUnclusteredEmails();

  // Apply limit if specified
  if (limit && unlinedEmails.length > limit) {
    unlinedEmails = unlinedEmails.slice(0, limit);
  }

  // Apply date range filter
  let recentEmails: typeof unlinedEmails;

  if (startDate || endDate) {
    // Custom date range provided
    recentEmails = unlinedEmails.filter(email => {
      const emailDate = new Date(email.date);
      if (startDate && emailDate < new Date(startDate)) return false;
      if (endDate && emailDate > new Date(endDate)) return false;
      return true;
    });
    console.log(`[Lining] Filtered to ${recentEmails.length} emails in date range (${startDate || 'any'} to ${endDate || 'any'})`);
  } else {
    // Default: last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    recentEmails = unlinedEmails.filter(email => {
      const emailDate = new Date(email.date);
      return emailDate >= thirtyDaysAgo;
    });
    console.log(`[Lining] Filtered to ${recentEmails.length} recent emails (last 30 days)`);
  }

  if (recentEmails.length === 0) {
    return NextResponse.json({
      lines: [],
      message: 'No recent emails found',
      linedCount: 0,
    });
  }

  console.log(`[Lining] Processing ${recentEmails.length} emails`);

  // Get existing lines
  const existingLines = await storage.getTopicLines();

  // Create a set of existing line IDs to check for duplicates
  const existingLineIds = new Set(existingLines.map(l => l.id));

  // Perform lining (thread-first with semantic fallback)
  const newLines = await lineService.clusterEmails(
    recentEmails,
    threshold || 0.65,
    existingLines
  );

  // Deduplicate new lines (in case of duplicates within the batch)
  const seenIds = new Set<string>();
  const dedupedLines: TopicLine[] = [];
  for (const line of newLines) {
    if (!seenIds.has(line.id)) {
      seenIds.add(line.id);
      dedupedLines.push(line);
    }
  }

  // Save only truly new lines (not in existing storage)
  const uniqueLines = dedupedLines.filter(l => !existingLineIds.has(l.id));
  for (const line of uniqueLines) {
    await storage.saveTopicLine(line);
  }

  console.log(`[API /api/graph/topics] Generated ${newLines.length} lines, deduped to ${dedupedLines.length}, skipped ${dedupedLines.length - uniqueLines.length} existing, saved ${uniqueLines.length} new`);

  return NextResponse.json({
    lines: uniqueLines,
    message: `Created ${uniqueLines.length} new topic lines`,
    linedCount: recentEmails.length,
  });
}

/**
 * Handle manual line creation
 * Allows users to create a line with specific emails
 */
async function handleCreateLine(userId: string, body: any) {
  const { name, description, emailIds } = body;

  if (!name || !Array.isArray(emailIds)) {
    return NextResponse.json(
      { error: 'Bad request', message: 'name and emailIds are required' },
      { status: 400 }
    );
  }

  const storage = new GraphStorageManager(userId);

  // Verify emails exist
  const emails = await storage.getEmails(emailIds);
  if (emails.length !== emailIds.length) {
    return NextResponse.json(
      { error: 'Bad request', message: 'Some email IDs not found' },
      { status: 400 }
    );
  }

  // Create line
  const now = Date.now();
  const line: TopicLine = {
    id: `line-manual-${now}`,
    name,
    description: description || `Manually created line: ${name}`,
    centroidEmbedding: [],
    emailIds,
    subjectVariations: emails.map(e => e.subject),
    firstEmailDate: Math.min(...emails.map(e => new Date(e.date).getTime())).toString(),
    lastEmailDate: Math.max(...emails.map(e => new Date(e.date).getTime())).toString(),
    confidence: 1.0, // Manual lines have high confidence
    userConfirmed: true,
    createdAt: now,
    updatedAt: now,
  };

  await storage.saveTopicLine(line);

  return NextResponse.json({
    line,
    message: 'Line created successfully',
  });
}

/**
 * Handle line update
 */
async function handleUpdateLine(userId: string, body: any) {
  const { lineId, name, description, userConfirmed, userRejected } = body;

  if (!lineId) {
    return NextResponse.json(
      { error: 'Bad request', message: 'lineId is required' },
      { status: 400 }
    );
  }

  const storage = new GraphStorageManager(userId);
  const line = await storage.getTopicLine(lineId);

  if (!line) {
    return NextResponse.json(
      { error: 'Not found', message: `Line ${lineId} not found` },
      { status: 404 }
    );
  }

  // Update fields
  if (name !== undefined) line.name = name;
  if (description !== undefined) line.description = description;
  if (userConfirmed !== undefined) {
    line.userConfirmed = userConfirmed;
    line.confidence = Math.min(1.0, line.confidence + 0.1);
  }
  if (userRejected !== undefined) {
    line.userRejected = userRejected;
  }
  line.updatedAt = Date.now();

  await storage.saveTopicLine(line);

  return NextResponse.json({
    line,
    message: 'Line updated successfully',
  });
}
