/**
 * Topics API Endpoint
 *
 * CRUD operations for topic clusters in the email knowledge graph.
 *
 * Endpoints:
 * GET  /api/graph/topics - Get all topic clusters
 * GET  /api/graph/topics/[id] - Get specific topic cluster
 * POST /api/graph/topics/cluster - Trigger clustering on unclustered emails
 * DELETE /api/graph/topics/[id] - Delete a topic cluster
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphStorageManager } from '@/services/graph/storage/graphStorageManager';
import { TopicClusteringService } from '@/services/graph/topicMapping/clusteringService';
import { TopicCluster } from '@/services/graph/types';
import { getUserIdFromRequest } from '../utils';

/**
 * GET /api/graph/topics
 * Returns all topic clusters for current user
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
    const clusters = await storage.getTopicClusters();

    return NextResponse.json({
      clusters,
      count: clusters.length,
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
 * Create or update topic clusters
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

    if (action === 'cluster') {
      // Trigger clustering on unclustered emails
      return await handleClustering(userId, body);
    } else if (action === 'create') {
      // Create a new cluster manually
      return await handleCreateCluster(userId, body);
    } else if (action === 'update') {
      // Update an existing cluster
      return await handleUpdateCluster(userId, body);
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
 * Delete a specific topic cluster
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

    const { id: clusterId } = await params;

    if (!clusterId) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Cluster ID is required' },
        { status: 400 }
      );
    }

    const storage = new GraphStorageManager(userId);
    await storage.deleteTopicCluster(clusterId);

    return NextResponse.json({
      success: true,
      message: `Cluster ${clusterId} deleted`,
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
 * Handle clustering action
 * Clusters unclustered emails using the clustering service
 */
async function handleClustering(userId: string, body: any) {
  const { threshold, limit } = body;

  const storage = new GraphStorageManager(userId);
  const clusteringService = new TopicClusteringService();

  // Get unclustered emails
  let unclusteredEmails = await storage.getUnclusteredEmails();

  // Apply limit if specified
  if (limit && unclusteredEmails.length > limit) {
    unclusteredEmails = unclusteredEmails.slice(0, limit);
  }

  if (unclusteredEmails.length === 0) {
    return NextResponse.json({
      clusters: [],
      message: 'No unclustered emails found',
      clusteredCount: 0,
    });
  }

  // Get existing clusters
  const existingClusters = await storage.getTopicClusters();

  // Perform clustering
  const newClusters = await clusteringService.clusterEmails(
    unclusteredEmails,
    threshold || 0.75,
    existingClusters
  );

  // Save new clusters
  for (const cluster of newClusters) {
    await storage.saveTopicCluster(cluster);
  }

  console.log(`[API /api/graph/topics] Clustered ${unclusteredEmails.length} emails into ${newClusters.length} clusters`);

  return NextResponse.json({
    clusters: newClusters,
    message: `Created ${newClusters.length} new topic clusters`,
    clusteredCount: unclusteredEmails.length,
  });
}

/**
 * Handle manual cluster creation
 * Allows users to create a cluster with specific emails
 */
async function handleCreateCluster(userId: string, body: any) {
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

  // Create cluster
  const now = Date.now();
  const cluster: TopicCluster = {
    id: `cluster-manual-${now}`,
    name,
    description: description || `Manually created cluster: ${name}`,
    centroidEmbedding: [],
    emailIds,
    subjectVariations: emails.map(e => e.subject),
    firstEmailDate: Math.min(...emails.map(e => new Date(e.date).getTime())).toString(),
    lastEmailDate: Math.max(...emails.map(e => new Date(e.date).getTime())).toString(),
    confidence: 1.0, // Manual clusters have high confidence
    userConfirmed: true,
    createdAt: now,
    updatedAt: now,
  };

  await storage.saveTopicCluster(cluster);

  return NextResponse.json({
    cluster,
    message: 'Cluster created successfully',
  });
}

/**
 * Handle cluster update
 */
async function handleUpdateCluster(userId: string, body: any) {
  const { clusterId, name, description, userConfirmed, userRejected } = body;

  if (!clusterId) {
    return NextResponse.json(
      { error: 'Bad request', message: 'clusterId is required' },
      { status: 400 }
    );
  }

  const storage = new GraphStorageManager(userId);
  const cluster = await storage.getTopicCluster(clusterId);

  if (!cluster) {
    return NextResponse.json(
      { error: 'Not found', message: `Cluster ${clusterId} not found` },
      { status: 404 }
    );
  }

  // Update fields
  if (name !== undefined) cluster.name = name;
  if (description !== undefined) cluster.description = description;
  if (userConfirmed !== undefined) {
    cluster.userConfirmed = userConfirmed;
    cluster.confidence = Math.min(1.0, cluster.confidence + 0.1);
  }
  if (userRejected !== undefined) {
    cluster.userRejected = userRejected;
  }
  cluster.updatedAt = Date.now();

  await storage.saveTopicCluster(cluster);

  return NextResponse.json({
    cluster,
    message: 'Cluster updated successfully',
  });
}
