/**
 * Topic Cluster View Component
 *
 * Displays topic clusters from the email knowledge graph.
 * Shows cluster name, email count, subject variations, and confidence score.
 *
 * This component enables users to explore emails grouped by semantic topics,
 * even when the subject lines differ.
 */

'use client';

import { useState, useEffect } from 'react';

interface TopicCluster {
  id: string;
  name: string;
  description: string;
  emailIds: string[];
  subjectVariations: string[];
  firstEmailDate: string;
  lastEmailDate: string;
  confidence: number;
  userConfirmed?: boolean;
  userRejected?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface TopicClusterViewProps {
  onClusterClick?: (cluster: TopicCluster) => void;
}

export function TopicClusterView({ onClusterClick }: TopicClusterViewProps) {
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<TopicCluster | null>(null);

  // Fetch clusters on mount
  useEffect(() => {
    fetchClusters();
  }, []);

  const fetchClusters = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/graph/topics');

      if (!response.ok) {
        throw new Error(`Failed to fetch clusters: ${response.statusText}`);
      }

      const data = await response.json();
      setClusters(data.clusters || []);
    } catch (err) {
      console.error('[TopicClusterView] Error fetching clusters:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const triggerClustering = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/graph/topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cluster',
          threshold: 0.75,
          limit: 50, // Cluster up to 50 unclustered emails
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to cluster emails: ${response.statusText}`);
      }

      const data = await response.json();
      setClusters(prev => [...prev, ...(data.clusters || [])]);
    } catch (err) {
      console.error('[TopicClusterView] Error clustering:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getConfidenceWidth = (confidence: number): string => {
    return `${Math.round(confidence * 100)}%`;
  };

  if (loading && clusters.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading topic clusters...
      </div>
    );
  }

  return (
    <div className="topic-cluster-view p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Topic Clusters
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {clusters.length} cluster{clusters.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button
          onClick={triggerClustering}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          {loading ? 'Clustering...' : 'Cluster New Emails'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* No clusters */}
      {clusters.length === 0 && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">
            No topic clusters found yet.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Clusters will be created automatically as you search and read emails,
            or you can manually trigger clustering now.
          </p>
          <button
            onClick={triggerClustering}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
          >
            Create First Clusters
          </button>
        </div>
      )}

      {/* Clusters list */}
      <div className="space-y-4">
        {clusters.map((cluster) => (
          <div
            key={cluster.id}
            onClick={() => {
              setSelectedCluster(cluster);
              onClusterClick?.(cluster);
            }}
            className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
          >
            {/* Cluster header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  {cluster.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {cluster.description}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {cluster.userConfirmed && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    ✓ Confirmed
                  </span>
                )}
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  {cluster.emailIds.length} email{cluster.emailIds.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Confidence</span>
                <span className="text-xs text-gray-600">
                  {Math.round(cluster.confidence * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getConfidenceColor(cluster.confidence)}`}
                  style={{ width: getConfidenceWidth(cluster.confidence) }}
                />
              </div>
            </div>

            {/* Subject variations */}
            {cluster.subjectVariations.length > 1 && (
              <div className="mb-2">
                <p className="text-xs text-gray-600 mb-1">Subject variations:</p>
                <div className="flex flex-wrap gap-2">
                  {cluster.subjectVariations.slice(0, 3).map((subject, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                    >
                      {subject.length > 40 ? subject.substring(0, 40) + '...' : subject}
                    </span>
                  ))}
                  {cluster.subjectVariations.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                      +{cluster.subjectVariations.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Date range */}
            <div className="flex items-center text-xs text-gray-600">
              <span>
                {new Date(cluster.firstEmailDate).toLocaleDateString()} — {new Date(cluster.lastEmailDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Selected cluster detail */}
      {selectedCluster && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Selected Cluster Details
          </h3>
          <div className="space-y-2 text-sm">
            <p><strong>ID:</strong> {selectedCluster.id}</p>
            <p><strong>Created:</strong> {new Date(selectedCluster.createdAt).toLocaleString()}</p>
            <p><strong>Email IDs:</strong> {selectedCluster.emailIds.join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
