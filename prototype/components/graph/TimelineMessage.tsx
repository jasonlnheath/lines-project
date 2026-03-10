/**
 * TimelineMessage Component
 * Message bubble wrapper for timeline with compact/expanded modes
 */

'use client';

import { EmailNode } from '@/services/graph/types';
import { MessageBubble } from './MessageBubble';
import { SenderAvatar } from './SenderAvatar';

interface TimelineMessageProps {
  email: EmailNode;
  isExpanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export function TimelineMessage({
  email,
  isExpanded,
  onToggle,
  compact = true,
}: TimelineMessageProps) {
  if (compact && !isExpanded) {
    return (
      <CompactMessageBubble
        email={email}
        onClick={onToggle}
      />
    );
  }

  return (
    <MessageBubble
      email={email}
      isExpanded={isExpanded}
      onToggle={onToggle}
    />
  );
}

// Compact version for collapsed timeline view
interface CompactMessageBubbleProps {
  email: EmailNode;
  onClick: () => void;
}

function CompactMessageBubble({ email, onClick }: CompactMessageBubbleProps) {
  // Get importance border color (with sent message override)
  const getBorderColor = () => {
    // Sent messages get green styling regardless of importance
    if (email.isSent) {
      return 'border-l-green-500';
    }

    switch (email.importance) {
      case 'high':
        return 'border-l-red-500';
      case 'low':
        return 'border-l-gray-300';
      default:
        return 'border-l-blue-400';
    }
  };

  // Get background color for sent messages
  const getBackgroundClass = () => {
    return email.isSent ? 'bg-green-50' : 'bg-white';
  };

  // Get sentiment dot color
  const getSentimentDot = () => {
    if (!email.sentiment) return null;

    const colors = {
      positive: 'bg-green-500',
      neutral: 'bg-gray-400',
      negative: 'bg-red-500',
    };

    return (
      <span
        className={`w-2 h-2 rounded-full ${colors[email.sentiment]}`}
        title={`Sentiment: ${email.sentiment}`}
      />
    );
  };

  // Format date compactly
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div
      className={`
        h-full flex flex-col rounded-lg shadow-sm border-l-4
        cursor-pointer hover:shadow-md transition-shadow duration-150
        overflow-hidden
        ${getBackgroundClass()}
        ${getBorderColor()}
      `}
      onClick={onClick}
    >
      {/* Compact header */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-100">
        <SenderAvatar email={email.from} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {email.subject}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {getSentimentDot()}
          <span className="text-xs text-gray-400">
            {formatDate(email.date)}
          </span>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 p-2 overflow-hidden">
        <p className="text-xs text-gray-600 line-clamp-2">
          {email.bodyPreview || email.body?.substring(0, 100) || 'No preview available'}
        </p>
      </div>

      {/* Quick info bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="text-gray-400">To:</span>
          <span className="truncate max-w-[100px]">
            {email.to.length > 1 ? `${email.to.length} recipients` : email.to[0]?.split('@')[0]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {email.hasAttachments && <span title="Has attachments">📎</span>}
          {email.topics && email.topics.length > 0 && (
            <span className="text-blue-600" title={email.topics.join(', ')}>
              #{email.topics[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
