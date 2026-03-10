/**
 * MessageBubble Component
 * Expandable container for email content in timeline
 * Single-tap to expand inline, double-tap for full modal
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { EmailNode } from '@/services/graph/types';
import { SenderAvatar } from './SenderAvatar';
import { ParticipantRowInline } from './ParticipantRow';

interface MessageBubbleProps {
  email: EmailNode;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenFull?: (email: EmailNode) => void;
  className?: string;
}

// Threshold for "short" email (characters)
const SHORT_EMAIL_THRESHOLD = 300;

// Threshold for "medium" email (shows preview + "read more")
const MEDIUM_EMAIL_THRESHOLD = 600;

export function MessageBubble({
  email,
  isExpanded,
  onToggle,
  onOpenFull,
  className = '',
}: MessageBubbleProps) {
  const [showFullBody, setShowFullBody] = useState(false);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle tap with double-tap detection
  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300) {
      // Double tap - open full modal
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      onOpenFull?.(email);
    } else {
      // Potential single tap - wait to confirm it's not a double
      tapTimeoutRef.current = setTimeout(() => {
        onToggle();
      }, 300);
    }

    lastTapRef.current = now;
  }, [email, onToggle, onOpenFull]);

  // Determine email length category
  const emailLength = email.body?.length || 0;
  const isShortEmail = emailLength <= SHORT_EMAIL_THRESHOLD;
  const isMediumEmail = emailLength <= MEDIUM_EMAIL_THRESHOLD;

  // Get display content
  const getDisplayContent = () => {
    if (!email.body) return email.bodyPreview || '';

    if (isShortEmail || (isExpanded && showFullBody)) {
      return email.body;
    }

    if (isMediumEmail || isExpanded) {
      return email.body.substring(0, SHORT_EMAIL_THRESHOLD) + '...';
    }

    return email.bodyPreview || email.body.substring(0, 150) + '...';
  };

  // Get importance color (with sent message override)
  const getImportanceColor = () => {
    // Sent messages get green styling regardless of importance
    if (email.isSent) {
      return 'border-l-green-500 bg-green-50';
    }

    switch (email.importance) {
      case 'high':
        return 'border-l-red-500 bg-red-50';
      case 'low':
        return 'border-l-gray-300 bg-gray-50';
      default:
        return 'border-l-blue-400 bg-white';
    }
  };

  // Get sentiment indicator
  const getSentimentIndicator = () => {
    if (!email.sentiment) return null;

    const colors = {
      positive: 'text-green-500',
      neutral: 'text-gray-400',
      negative: 'text-red-500',
    };

    const icons = {
      positive: '↗',
      neutral: '→',
      negative: '↘',
    };

    return (
      <span className={`text-sm ${colors[email.sentiment]}`} title={`Sentiment: ${email.sentiment}`}>
        {icons[email.sentiment]}
      </span>
    );
  };

  return (
    <div
      className={`
        rounded-lg border-l-4 shadow-sm cursor-pointer
        transition-all duration-200 ease-in-out
        hover:shadow-md
        ${getImportanceColor()}
        ${isExpanded ? 'p-4' : 'p-2'}
        ${className}
      `}
      onClick={handleTap}
    >
      {/* Header: Avatar, Subject, Date */}
      <div className="flex items-start gap-2">
        <SenderAvatar
          email={email.from}
          size={isExpanded ? 'md' : 'sm'}
          showStatus={email.importance === 'high'}
          statusColor={email.importance === 'high' ? 'bg-red-500' : undefined}
        />

        <div className="flex-1 min-w-0">
          {/* Subject line */}
          <div className="flex items-center gap-2">
            <h4 className={`font-medium text-gray-900 truncate ${isExpanded ? 'text-base' : 'text-sm'}`}>
              {email.subject}
            </h4>
            {getSentimentIndicator()}
          </div>

          {/* Date and preview when collapsed */}
          {!isExpanded && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {new Date(email.date).toLocaleDateString()} • {email.bodyPreview}
            </p>
          )}

          {/* Date when expanded */}
          {isExpanded && (
            <p className="text-xs text-gray-500 mt-1">
              {new Date(email.date).toLocaleString()}
            </p>
          )}
        </div>

        {/* Expand/collapse indicator */}
        <span className="text-gray-400 text-lg">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Participant row */}
          <ParticipantRowInline
            from={email.from}
            to={email.to}
            maxVisible={4}
          />

          {/* Email body */}
          <div className="text-sm text-gray-700 whitespace-pre-wrap">
            {getDisplayContent()}
          </div>

          {/* Read more / Show less for long emails */}
          {(emailLength > SHORT_EMAIL_THRESHOLD) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFullBody(!showFullBody);
              }}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              {showFullBody ? 'Show less' : 'Read more'}
            </button>
          )}

          {/* Topics/Keywords */}
          {email.topics && email.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {email.topics.map(topic => (
                <span
                  key={topic}
                  className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}

          {/* Attachments indicator */}
          {email.hasAttachments && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>📎</span>
              <span>Has attachments</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenFull?.(email);
              }}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Open
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Reply
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Forward
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
