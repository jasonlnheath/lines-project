/**
 * Line Suggestions API Endpoint
 *
 * Get, accept, or reject suggestions for a specific line.
 *
 * Endpoints:
 * GET    /api/graph/lines/[id]/suggestions - Get pending suggestions
 * POST   /api/graph/lines/[id]/suggestions - Accept/reject suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphStorageManager } from '@/services/graph/storage/graphStorageManager';
import { SemanticProfileManager } from '@/services/graph/semanticProfileManager';
import { SuggestionQueueService } from '@/services/graph/suggestionQueueService';
import { getUserIdFromRequest } from '../../../utils';

/**
 * GET /api/graph/lines/[id]/suggestions
 * Get pending suggestions for a line
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const storage = new GraphStorageManager(userId);
    const line = await storage.getTopicLine(lineId);

    if (!line) {
      return NextResponse.json(
        { error: 'Not found', message: `Line ${lineId} not found` },
        { status: 404 }
      );
    }

    const profileManager = new SemanticProfileManager(storage);
    const suggestionService = new SuggestionQueueService(userId, storage, profileManager);

    await suggestionService.initialize();

    const suggestions = await suggestionService.getPendingSuggestions(lineId);

    // Enrich suggestions with additional details
    const enrichedSuggestions = await Promise.all(
      suggestions.map(async (s) => {
        const enriched: any = { ...s };

        if (s.type === 'orphan_branch' && s.sourceEmailId) {
          const email = await storage.getEmail(s.sourceEmailId);
          if (email) {
            enriched.emailDetails = {
              id: email.id,
              subject: email.subject,
              from: email.from,
              date: email.date,
              bodyPreview: email.bodyPreview,
            };
          }
        } else if (s.type === 'thread_merge' && s.sourceLineId) {
          const sourceLine = await storage.getTopicLine(s.sourceLineId);
          if (sourceLine) {
            enriched.lineDetails = {
              id: sourceLine.id,
              name: sourceLine.name,
              description: sourceLine.description,
              emailCount: sourceLine.emailIds.length,
              subjectVariations: sourceLine.subjectVariations,
            };
          }
        }

        return enriched;
      })
    );

    return NextResponse.json({
      lineId,
      suggestions: enrichedSuggestions,
      count: enrichedSuggestions.length,
    });
  } catch (error) {
    console.error('[API /api/graph/lines/[id]/suggestions] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/graph/lines/[id]/suggestions
 * Accept or reject a suggestion
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const body = await request.json();
    const { action, suggestionId } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Bad request', message: 'action is required (accept or reject)' },
        { status: 400 }
      );
    }

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Bad request', message: 'action must be "accept" or "reject"' },
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

    const profileManager = new SemanticProfileManager(storage);
    const suggestionService = new SuggestionQueueService(userId, storage, profileManager);

    await suggestionService.initialize();

    if (action === 'accept') {
      await suggestionService.acceptSuggestion(suggestionId);
      console.log(`[Suggestions] Accepted suggestion ${suggestionId} for line ${lineId}`);

      // Update line metadata
      line.branchCount = (line.branchCount || 0) + 1;
      line.lastMergeAt = Date.now();
      line.pendingSuggestionCount = Math.max(0, (line.pendingSuggestionCount || 1) - 1);
      await storage.saveTopicLine(line);

      return NextResponse.json({
        success: true,
        message: 'Suggestion accepted',
        action: 'accepted',
      });
    } else {
      await suggestionService.rejectSuggestion(suggestionId);
      console.log(`[Suggestions] Rejected suggestion ${suggestionId} for line ${lineId}`);

      // Update line metadata
      line.pendingSuggestionCount = Math.max(0, (line.pendingSuggestionCount || 1) - 1);
      await storage.saveTopicLine(line);

      return NextResponse.json({
        success: true,
        message: 'Suggestion rejected',
        action: 'rejected',
      });
    }
  } catch (error) {
    console.error('[API /api/graph/lines/[id]/suggestions] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}
