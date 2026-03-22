/**
 * Line Search API Endpoint
 *
 * Semantic search across email lines with learning loop.
 * Finds lines by semantic similarity, then identifies related orphans and threads.
 *
 * Endpoint: GET /api/graph/lines/search
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphStorageManager } from '@/services/graph/storage/graphStorageManager';
import { SemanticProfileManager } from '@/services/graph/semanticProfileManager';
import { SuggestionQueueService } from '@/services/graph/suggestionQueueService';
import { getUserIdFromRequest } from '../../utils';

/**
 * GET /api/graph/lines/search
 * Semantic line search with learning loop
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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const maxLines = parseInt(searchParams.get('maxLines') || '5');
    const includeOrphanSearch = searchParams.get('includeOrphanSearch') !== 'false';
    const includeThreadMerge = searchParams.get('includeThreadMerge') !== 'false';
    const queueSuggestions = searchParams.get('queueSuggestions') !== 'false';
    const minScore = parseFloat(searchParams.get('minScore') || '0.3');

    if (!query) {
      return NextResponse.json(
        { error: 'Bad request', message: 'query parameter is required' },
        { status: 400 }
      );
    }

    console.log('[LineSearch] Starting search:', {
      query,
      maxLines,
      includeOrphanSearch,
      includeThreadMerge,
      queueSuggestions,
      minScore,
    });

    const storage = new GraphStorageManager(userId);
    const profileManager = new SemanticProfileManager(storage);
    const suggestionService = new SuggestionQueueService(userId, storage, profileManager, {
      queueThreshold: minScore,
      maxSuggestionsPerCluster: 50,
      maxThreadMergeCandidates: 10,
    });

    await suggestionService.initialize();

    // Get all lines
    const allLines = await storage.getTopicLines();

    // Search lines by semantic similarity to query
    const matchingLines = await searchLinesByQuery(
      allLines,
      query,
      profileManager,
      maxLines
    );

    console.log(`[LineSearch] Found ${matchingLines.length} matching lines`);

    // Find and queue suggestions for matching lines
    let totalSuggestionsQueued = 0;
    const suggestionTypes = { orphanBranches: 0, threadMerges: 0 };

    if (queueSuggestions) {
      for (const lineResult of matchingLines) {
        const suggestions = await suggestionService.findSuggestions(lineResult.line, {
          searchOrphans: includeOrphanSearch,
          searchClusters: includeThreadMerge,
        });

        if (suggestions.length > 0) {
          const result = await suggestionService.processSuggestions(suggestions);

          // Count suggestion types
          for (const s of result.queued) {
            if (s.type === 'orphan_branch') {
              suggestionTypes.orphanBranches++;
            } else if (s.type === 'thread_merge') {
              suggestionTypes.threadMerges++;
            }
          }

          totalSuggestionsQueued += result.queued.length;

          console.log(`[LineSearch] Line ${lineResult.line.id}: ${result.queued.length} suggestions queued, ${result.autoExecuted.length} auto-executed`);
        }
      }
    }

    // Update line suggestion counts
    for (const lineResult of matchingLines) {
      const pending = await suggestionService.getPendingSuggestions(lineResult.line.id);
      lineResult.line.pendingSuggestionCount = pending.length;
      await storage.saveTopicLine(lineResult.line);
    }

    return NextResponse.json({
      query,
      lines: matchingLines.map(l => ({
        id: l.line.id,
        name: l.line.name,
        description: l.line.description,
        emailCount: l.line.emailIds.length,
        subjectVariations: l.line.subjectVariations,
        confidence: l.line.confidence,
        relevanceScore: l.relevanceScore,
        pendingSuggestions: l.line.pendingSuggestionCount,
        keyTerms: l.line.keyTerms,
      })),
      suggestionsQueued: totalSuggestionsQueued,
      suggestionTypes,
      autoBranchEnabled: suggestionService.getConfig().autoBranchEnabled,
    });
  } catch (error) {
    console.error('[API /api/graph/lines/search] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Search lines by query using semantic similarity
 */
async function searchLinesByQuery(
  lines: any[],
  query: string,
  profileManager: SemanticProfileManager,
  limit: number
): Promise<Array<{ line: any; relevanceScore: number }>> {
  const results: Array<{ line: any; relevanceScore: number }> = [];

  // Tokenize query
  const queryTerms = new Set(
    query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
  );

  for (const line of lines) {
    let score = 0;
    let factors = 0;

    // Get profile
    const profile = await profileManager.getProfile(line.id);

    // Key term matching
    if (profile && profile.keyTerms.size > 0) {
      let termMatches = 0;
      let totalWeight = 0;

      for (const queryTerm of queryTerms) {
        if (profile.keyTerms.has(queryTerm)) {
          termMatches++;
          totalWeight += profile.keyTerms.get(queryTerm)!;
        }
      }

      if (queryTerms.size > 0) {
        const termScore = termMatches > 0 ? totalWeight / queryTerms.size : 0;
        score += termScore * 0.7; // 70% weight on term matching
        factors += 0.7;
      }
    }

    // Name/description matching (fallback)
    const nameLower = line.name.toLowerCase();
    const descLower = line.description.toLowerCase();
    const queryLower = query.toLowerCase();

    const nameMatch = nameLower.includes(queryLower) ? 1 : 0;
    const descMatch = descLower.includes(queryLower) ? 1 : 0;
    const textScore = (nameMatch * 0.7 + descMatch * 0.3);
    score += textScore * 0.3; // 30% weight on text matching
    factors += 0.3;

    // Subject variations matching
    let subjectMatchCount = 0;
    for (const subject of line.subjectVariations || []) {
      if (subject.toLowerCase().includes(queryLower)) {
        subjectMatchCount++;
      }
    }
    if (subjectMatchCount > 0) {
      score += Math.min(subjectMatchCount * 0.1, 0.2); // Up to 0.2 bonus
      factors += 0.2;
    }

    if (factors > 0) {
      results.push({
        line,
        relevanceScore: score / factors,
      });
    }
  }

  // Sort by relevance and limit
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return results.slice(0, limit);
}
