/**
 * useTimelineData Hook
 * Fetches emails for a line and manages loading state
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { EmailNode, TopicLine } from '@/services/graph/types';

interface TimelineData {
  emails: EmailNode[];
  line: TopicLine | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTimelineData(lineId: string | null): TimelineData {
  const [emails, setEmails] = useState<EmailNode[]>([]);
  const [line, setLine] = useState<TopicLine | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!lineId) {
      setEmails([]);
      setLine(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch line details
      const lineResponse = await fetch(`/api/graph/topics`);
      const lineData = await lineResponse.json();

      const foundLine = lineData.lines?.find(
        (l: TopicLine) => l.id === lineId
      );

      if (!foundLine) {
        throw new Error('Line not found');
      }

      setLine(foundLine);

      // Fetch emails in line
      const emailsResponse = await fetch(
        `/api/graph/emails?lineId=${lineId}`
      );

      if (!emailsResponse.ok) {
        // Fallback: try to get emails from storage directly
        // For now, use the line's emailIds to fetch individually
        const emailPromises = foundLine.emailIds.map(async (emailId: string) => {
          const res = await fetch(`/api/graph/emails/${emailId}`);
          if (res.ok) {
            return res.json();
          }
          return null;
        });

        const emailResults = await Promise.all(emailPromises);
        const validEmails = emailResults.filter(Boolean);
        setEmails(validEmails);
      } else {
        const emailsData = await emailsResponse.json();
        setEmails(emailsData.emails || []);
      }
    } catch (err) {
      console.error('[useTimelineData] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch timeline data');
    } finally {
      setLoading(false);
    }
  }, [lineId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    emails,
    line,
    loading,
    error,
    refetch: fetchData,
  };
}
