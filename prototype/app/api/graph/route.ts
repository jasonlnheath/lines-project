/**
 * Graph API Endpoint
 *
 * Main API for email knowledge graph operations.
 * Provides endpoints for retrieving and managing the complete graph.
 *
 * Endpoints:
 * GET  /api/graph - Get complete knowledge graph
 * GET  /api/graph/stats - Get graph statistics
 * GET  /api/graph/emails - Get all indexed emails
 * GET  /api/graph/exists - Check if graph exists for user
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphStorageManager } from '@/services/graph/storage/graphStorageManager';
import { getUserIdFromRequest } from './utils';

/**
 * GET /api/graph
 * Returns complete knowledge graph for current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from session (using the same pattern as other API routes)
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const storage = new GraphStorageManager(userId);
    const graph = await storage.loadGraph();

    if (!graph) {
      return NextResponse.json({
        exists: false,
        message: 'No graph found for user. Add emails to the graph first.',
      });
    }

    // Convert Maps to plain objects for JSON serialization
    const response = {
      exists: true,
      userId: graph.userId,
      version: graph.version,
      lastUpdated: graph.lastUpdated,
      emailCount: graph.emails.size,
      topicClusterCount: graph.topicClusters.size,
      connectionCount: graph.connections.size,

      // Include counts for indexes
      conversationCount: graph.emailByConversation.size,
      senderCount: graph.emailBySender.size,

      // Don't include full graph data in this endpoint
      // Use specific endpoints for detailed data
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /api/graph] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}
