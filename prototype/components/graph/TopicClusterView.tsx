/**
 * Topic Cluster View Component
 *
 * Enhanced view with timeline visualization for exploring email clusters.
 * Shows cluster sidebar and timeline with message bubbles, connections, and auto-zoom.
 */

'use client';

import { useState, useEffect } from 'react';
import { ClusterSidebar } from './ClusterSidebar';
import { TimelineView } from './TimelineView';
import { useTimelineData } from '@/hooks/useTimelineData';
import { TopicCluster } from '@/services/graph/types';

interface TopicClusterViewProps {
  onClusterClick?: (cluster: TopicCluster) => void;
}

export function TopicClusterView({ onClusterClick }: TopicClusterViewProps) {
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.65);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '180d' | '365d' | 'all'>('30d');
  const [progress, setProgress] = useState<{
    emailCount: number;
    clusterCount: number;
    clusteredEmails: number;
    oldestClusteredDate: string | null;
  } | null>(null);

  // Use timeline data hook
  const { emails, cluster, loading: timelineLoading, error: timelineError } = useTimelineData(selectedClusterId);

  // Fetch clusters on mount
  useEffect(() => {
    fetchClusters();
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const response = await fetch('/api/graph/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'progress' }),
      });
      const data = await response.json();
      setProgress(data);
    } catch (err) {
      console.error('[TopicClusterView] Error fetching progress:', err);
    }
  };

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

  const handleClusterSelect = (selectedCluster: TopicCluster) => {
    setSelectedClusterId(selectedCluster.id);
    onClusterClick?.(selectedCluster);
  };

  const triggerClustering = async () => {
    setLoading(true);
    setError(null);

    // Calculate date range based on selection
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (timeRange !== 'all') {
      const days = parseInt(timeRange);
      const start = new Date();
      start.setDate(start.getDate() - days);
      startDate = start.toISOString();
      endDate = new Date().toISOString();
    }

    try {
      const response = await fetch('/api/graph/topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cluster',
          threshold: threshold,
          limit: 100,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to cluster emails: ${response.statusText}`);
      }

      const data = await response.json();
      setClusters(data.clusters || []);
      // Refresh progress after clustering
      await fetchProgress();
    } catch (err) {
      console.error('[TopicClusterView] Error clustering:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && clusters.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading topic clusters...
      </div>
    );
  }

  return (
    <div className="flex h-[650px]">
      {/* Cluster Sidebar */}
      <div className="w-80 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Clusters</h2>
          <span className="text-sm text-gray-500">{clusters.length}</span>
        </div>

        {clusters.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No clusters yet</p>
            <button
              onClick={triggerClustering}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
            >
              Cluster Emails
            </button>
          </div>
        )}

        {clusters.length > 0 && (
          <>
            {/* Threshold selector */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 block mb-1">Similarity Threshold</label>
              <select
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full text-sm border rounded px-2 py-1.5 bg-white"
              >
                <option value={0.5}>Low (0.5) - More groups</option>
                <option value={0.65}>Medium (0.65) - Balanced</option>
                <option value={0.75}>High (0.75) - Strict</option>
              </select>
            </div>

            {/* Time Range Selector */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 block mb-1">Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="w-full text-sm border rounded px-2 py-1.5 bg-white"
              >
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="180d">Last 6 Months</option>
                <option value="365d">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Progress Indicator */}
            {progress && (
              <div className="mb-3 p-2 bg-gray-100 rounded text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Clusters:</span>
                  <span className="font-medium">{progress.clusterCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Emails clustered:</span>
                  <span className="font-medium">{progress.clusteredEmails}/{progress.emailCount}</span>
                </div>
                {progress.oldestClusteredDate && (
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-600">Oldest clustered:</span>
                    <span className="font-medium">{new Date(progress.oldestClusteredDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={triggerClustering}
              disabled={loading}
              className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 text-sm"
            >
              {loading ? 'Clustering...' : 'Cluster New Emails'}
            </button>

            <ClusterSidebar
              clusters={clusters}
              selectedClusterId={selectedClusterId}
              onClusterSelect={handleClusterSelect}
            />
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!selectedClusterId && (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                Select a Cluster
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                Choose a cluster from the sidebar to view its timeline
              </p>
            </div>
          </div>
        )}

        {selectedClusterId && timelineLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-600">Loading timeline...</span>
            </div>
          </div>
        )}

        {selectedClusterId && timelineError && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
              <p className="text-sm text-red-600">{timelineError}</p>
              <button
                onClick={() => setSelectedClusterId(null)}
                className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {selectedClusterId && cluster && !timelineLoading && !timelineError && (
          <TimelineView
            cluster={cluster}
            emails={emails}
          />
        )}
      </div>
    </div>
  );
}
