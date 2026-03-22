/**
 * AgentChatPanel Component
 * Persistent chat panel at bottom of screen
 * Collapsed by default (40px bar with icon)
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolTrace?: {
    tool: string;
    duration: number;
    result: string;
  }[];
}

interface AgentChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  className?: string;
}

// Chat bubble component
function ChatBubble({ message, isUser }: { message: ChatMessage; isUser: boolean }) {
  const formattedTime = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] p-3 rounded-lg ${
        isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
      }`}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className="text-xs text-gray-400 mt-1">{formattedTime}</p>
      </div>
    </div>
  );
}

export function AgentChatPanel({
  messages,
  onSendMessage,
  isLoading = false,
  className = '',
}: AgentChatPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [height, setHeight] = useState(200);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isExpanded]);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(100, Math.min(500, startHeight + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height]);

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  // Collapsed state
  if (!isExpanded) {
    return (
      <div className={`flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 cursor-pointer hover:bg-gray-100 ${className}`}
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <span className="text-sm text-gray-600">Agent Chat</span>
          {messages.length > 0 && (
            <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">Click to expand</span>
      </div>
    );
  }

  // Expanded state
  return (
    <div className={`flex flex-col bg-white border-t border-gray-200 shadow-lg ${className}`}
      style={{ height }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <span className="text-sm font-medium text-gray-700">Agent</span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-gray-600 p-1"
        >
          ▼
        </button>
      </div>

      {/* Resize handle */}
      <div
        ref={resizeRef}
        className="h-1 cursor-row-resize hover:bg-gray-200"
        onMouseDown={handleMouseDown}
      />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 space-y-2">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            isUser={message.role === 'user'}
          />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 p-3">
            <div className="w-2 h-2 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Agent is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex gap-2 px-3 py-2 border-t border-gray-200">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isLoading) {
              handleSend();
            }
          }}
          placeholder="Ask the agent..."
          className="flex-1 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
