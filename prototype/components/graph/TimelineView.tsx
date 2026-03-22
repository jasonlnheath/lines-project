/**
 * TimelineView Component
 * Horizontal timeline with auto-zoom (messages expand/contract on scroll)
 * Line width stays fixed unless window height changes
 */

'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { EmailNode, TopicLine, TimelineEvent } from '@/services/graph/types';
import { TimelineMessage } from './TimelineMessage';
import { TimelineConnection } from './TimelineConnection';

interface TimelineViewProps {
  line: TopicLine;
  emails: EmailNode[];
  className?: string;
}

// Minimum timeline width to ensure scrollability
const MIN_TIMELINE_WIDTH = 1200;
const EMAIL_WIDTH = 300;
const PADDING = 100;

// Calculate timeline positions for emails
function calculateTimelinePositions(
  emails: EmailNode[],
  containerWidth: number
): Map<string, { x: number; y: number; event: TimelineEvent }> {
  const positions = new Map<string, { x: number; y: number; event: TimelineEvent }>();

  if (emails.length === 0) return positions;

  // Sort emails by date
  const sorted = [...emails].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // For single email, center it in the viewport
  if (sorted.length === 1) {
    const x = containerWidth / 2;
    const time = new Date(sorted[0].date).getTime();

    const event: TimelineEvent = {
      id: `event-${sorted[0].id}`,
      emailId: sorted[0].id,
      timestamp: time,
      type: 'thread_start',
      x,
      y: 0,
      connectedTo: [],
      connectionTypes: [],
    };

    positions.set(sorted[0].id, { x, y: 0, event });
    return positions;
  }

  // Calculate time range for multiple emails
  const dates = sorted.map(e => new Date(e.date).getTime());
  const minTime = Math.min(...dates);
  const maxTime = Math.max(...dates);
  const timeRange = maxTime - minTime || 1;

  // Calculate usable width
  const usableWidth = containerWidth - (PADDING * 2);

  // Track used positions to prevent overlap (emails with same/similar timestamps)
  const usedPositions = new Map<number, number>();

  // Calculate positions
  sorted.forEach((email, index) => {
    const time = new Date(email.date).getTime();
    let normalizedTime = (time - minTime) / timeRange;

    // If this position is already used, add a small offset to prevent overlap
    // Round to 2 decimal places to group very close timestamps together
    const positionKey = Math.floor(normalizedTime * 100);
    const existingCount = usedPositions.get(positionKey) || 0;
    if (existingCount > 0) {
      // Add 3% offset per duplicate to space them out
      normalizedTime += (existingCount * 0.03);
    }
    usedPositions.set(positionKey, existingCount + 1);

    const x = PADDING + (normalizedTime * usableWidth);

    const event: TimelineEvent = {
      id: `event-${email.id}`,
      emailId: email.id,
      timestamp: time,
      type: index === 0 ? 'thread_start' : 'received',
      x,
      y: 0,
      connectedTo: index > 0 ? [`event-${sorted[index - 1].id}`] : [],
      connectionTypes: index > 0 ? ['thread'] : [],
    };

    positions.set(email.id, { x, y: 0, event });
  });

  return positions;
}

// Calculate message height based on visible count and viewport
function calculateAutoZoomHeight(
  visibleCount: number,
  viewportHeight: number,
  baseHeight: number = 120,
  minHeight: number = 60,
  maxHeight: number = 300
): number {
  const idealHeight = viewportHeight / Math.max(visibleCount, 1);
  const scaledHeight = idealHeight * 0.8;

  return Math.max(minHeight, Math.min(scaledHeight, maxHeight));
}

export function TimelineView({ line, emails, className = '' }: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(MIN_TIMELINE_WIDTH);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftStart, setScrollLeftStart] = useState(0);

  // Calculate minimum width needed for all emails
  const minRequiredWidth = useMemo(() => {
    if (emails.length === 0) return MIN_TIMELINE_WIDTH;
    if (emails.length === 1) return MIN_TIMELINE_WIDTH;
    // Space emails out with minimum spacing
    return Math.max(MIN_TIMELINE_WIDTH, emails.length * (EMAIL_WIDTH + 50) + PADDING * 2);
  }, [emails.length]);

  // Calculate timeline positions
  const positions = useMemo(
    () => calculateTimelinePositions(emails, minRequiredWidth),
    [emails, minRequiredWidth]
  );

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      setViewportHeight(window.innerHeight * 0.5);
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Handle scroll for auto-zoom
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  }, []);

  // Handle drag-to-pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeftStart(scrollContainerRef.current.scrollLeft);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    scrollContainerRef.current.scrollLeft = scrollLeftStart - walk;
  }, [isDragging, startX, scrollLeftStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Calculate visible messages
  const visibleRange = useMemo(() => {
    const scrollLeft = scrollPosition;
    const visibleWidth = scrollContainerRef.current?.clientWidth || 800;

    let visibleCount = 0;

    positions.forEach((pos) => {
      const isVisible = pos.x >= scrollLeft - EMAIL_WIDTH && pos.x <= scrollLeft + visibleWidth + EMAIL_WIDTH;
      if (isVisible) {
        visibleCount++;
      }
    });

    return { visibleCount: Math.max(visibleCount, 1) };
  }, [scrollPosition, positions]);

  // Calculate message height based on auto-zoom
  const messageHeight = useMemo(
    () => calculateAutoZoomHeight(visibleRange.visibleCount, viewportHeight),
    [visibleRange.visibleCount, viewportHeight]
  );

  // Toggle message expansion
  const toggleMessage = useCallback((emailId: string) => {
    setExpandedMessage(prev => prev === emailId ? null : emailId);
  }, []);

  // Render time axis
  const renderTimeAxis = () => {
    if (emails.length === 0) return null;

    const dates = emails.map(e => new Date(e.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Generate tick marks
    const ticks: { position: number; label: string }[] = [];
    const tickCount = 5;
    const usableWidth = minRequiredWidth - (PADDING * 2);

    for (let i = 0; i <= tickCount; i++) {
      const position = PADDING + (i / tickCount) * usableWidth;
      const date = new Date(minDate.getTime() + (i / tickCount) * (maxDate.getTime() - minDate.getTime()));
      ticks.push({
        position,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }

    return (
      <div className="h-8 border-b border-gray-200 relative">
        {ticks.map((tick, i) => (
          <div
            key={i}
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: tick.position }}
          >
            <div className="w-px h-2 bg-gray-300" />
            <span className="text-xs text-gray-500 mt-1">{tick.label}</span>
          </div>
        ))}
      </div>
    );
  };

  // Render connection lines
  const renderConnections = () => {
    if (emails.length <= 1) return null;

    const connections: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];

    const sortedEmails = [...emails].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (let i = 1; i < sortedEmails.length; i++) {
      const fromPos = positions.get(sortedEmails[i - 1].id);
      const toPos = positions.get(sortedEmails[i].id);

      if (fromPos && toPos) {
        connections.push({
          from: { x: fromPos.x, y: fromPos.y },
          to: { x: toPos.x, y: toPos.y },
        });
      }
    }

    return (
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={minRequiredWidth}
        height={messageHeight + 40}
        style={{ overflow: 'visible' }}
      >
        {connections.map((conn, i) => (
          <TimelineConnection
            key={i}
            from={conn.from}
            to={conn.to}
            messageHeight={messageHeight}
          />
        ))}
      </svg>
    );
  };

  if (emails.length === 0) {
    return (
      <div className={'flex items-center justify-center h-64 text-gray-500 ' + className}>
        No emails in this line
      </div>
    );
  }

  return (
    <div className={'flex flex-col h-full ' + className}>
      {/* Line header */}
      <div className="px-4 py-2 bg-gray-50 border-b">
        <h3 className="font-semibold text-gray-900">{line.name}</h3>
        <p className="text-sm text-gray-600">{line.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">{emails.length} email{emails.length !== 1 ? 's' : ''}</span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">
            Confidence: {Math.round(line.confidence * 100)}%
          </span>
          {emails.length > 1 && (
            <>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-blue-500">Scroll horizontally to navigate</span>
            </>
          )}
        </div>
      </div>

      {/* Time axis */}
      {renderTimeAxis()}

      {/* Timeline scroll container */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-x-auto overflow-y-hidden relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Connection lines */}
        {renderConnections()}

        {/* Message bubbles container */}
        <div
          ref={containerRef}
          className="relative ml-6"
          style={{ width: minRequiredWidth, height: messageHeight + 60 }}
        >
          {emails.map(email => {
            const pos = positions.get(email.id);
            if (!pos) return null;

            const isExpanded = expandedMessage === email.id;

            return (
              <div
                key={email.id}
                className="absolute transition-all duration-300 ease-in-out"
                style={{
                  left: pos.x - EMAIL_WIDTH / 2,
                  top: 10,
                  width: EMAIL_WIDTH,
                  height: isExpanded ? 'auto' : messageHeight,
                  zIndex: isExpanded ? 10 : 1,
                }}
              >
                <TimelineMessage
                  email={email}
                  isExpanded={isExpanded}
                  onToggle={() => toggleMessage(email.id)}
                  compact={!isExpanded}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
