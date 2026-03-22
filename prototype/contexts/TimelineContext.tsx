/**
 * TimelineContext
 * State management for timeline view
 */

'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { TopicLine } from '@/services/graph/types';

interface TimelineState {
  selectedLine: TopicLine | null;
  setSelectedLine: (line: TopicLine | null) => void;
  expandedMessages: Set<string>;
  toggleMessage: (emailId: string) => void;
  viewMode: 'chronological' | 'thread' | 'topic';
  setViewMode: (mode: TimelineState['viewMode']) => void;
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  scrollPosition: number;
  setScrollPosition: (position: number) => void;
}

const TimelineContext = createContext<TimelineState | undefined>(undefined);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [selectedLine, setSelectedLine] = useState<TopicLine | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<TimelineState['viewMode']>('chronological');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scrollPosition, setScrollPosition] = useState(0);

  const toggleMessage = useCallback((emailId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  }, []);

  const value: TimelineState = {
    selectedLine,
    setSelectedLine,
    expandedMessages,
    toggleMessage,
    viewMode,
    setViewMode,
    zoomLevel,
    setZoomLevel,
    scrollPosition,
    setScrollPosition,
  };

  return (
    <TimelineContext.Provider value={value}>
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimeline() {
  const context = useContext(TimelineContext);
  if (context === undefined) {
    throw new Error('useTimeline must be used within a TimelineProvider');
  }
  return context;
}
