'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { TopicClusterView } from './graph/TopicClusterView';

interface ToolTraceEntry {
  tool: string;
  inputs: any;
  outputs: any;
  duration: number;
  timestamp: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentResponse {
  answer: string;
  toolTrace: ToolTraceEntry[];
  conversationHistory?: Message[];
  toolResults?: Record<string, any>;
}

// Message bubble component
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-900'
      }`}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-lg px-4 py-3">
        <div className="flex space-x-1 items-center">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    </div>
  );
}

export function SearchInterface() {
  const { authenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // View mode state: 'chat' or 'clusters'
  const [viewMode, setViewMode] = useState<'chat' | 'clusters'>('chat');

  // Conversation state
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [toolResults, setToolResults] = useState<Record<string, any>>({});

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, loading, response]);

  // New topic handler
  const handleNewTopic = () => {
    setConversationHistory([]);
    setToolResults({});
    setResponse(null);
    setQuery('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim() || loading) return;

    // Add user message immediately to UI
    const userMessage: Message = { role: 'user', content: query };
    setConversationHistory(prev => [...prev, userMessage]);
    const currentQuery = query;
    setQuery('');

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/agent/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: currentQuery,
          conversationHistory: [...conversationHistory, userMessage],
          previousToolResults: toolResults,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.refreshRequired) {
          setError('Your session has expired. Please refresh the page.');
        } else {
          setError(data.error || 'Failed to process query');
        }
        // Remove user message on error
        setConversationHistory(prev => prev.slice(0, -1));
        setQuery(currentQuery);
        return;
      }

      const data: AgentResponse = await res.json();
      setResponse(data);

      // Update conversation state from server response
      if (data.conversationHistory) {
        setConversationHistory(data.conversationHistory);
      }
      if (data.toolResults) {
        setToolResults(data.toolResults);
      }
    } catch (err) {
      setError('Failed to connect to the service');
      // Remove user message on error
      setConversationHistory(prev => prev.slice(0, -1));
      setQuery(currentQuery);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-md border border-gray-200">
      {/* Header with View Toggle and New Topic button */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {viewMode === 'chat' ? 'Email Assistant' : 'Topic Clusters'}
          </h2>
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('chat')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'chat'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setViewMode('clusters')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'clusters'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Clusters
            </button>
          </div>
        </div>
        {viewMode === 'chat' && (conversationHistory.length > 0 || toolResults && Object.keys(toolResults).length > 0) && (
          <button
            onClick={handleNewTopic}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            New Topic
          </button>
        )}
      </div>

      {/* Content area */}
      {viewMode === 'clusters' ? (
        /* Topic Cluster View */
        <div className="flex-1 overflow-y-auto">
          <TopicClusterView />
        </div>
      ) : (
        <>
          {/* Scrollable message area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {conversationHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="text-lg font-medium">Start a conversation</p>
                </div>
                <p className="text-sm text-gray-500 max-w-md">
                  Ask about your emails... (e.g., &quot;Show me emails from John about the project&quot;)
                </p>
              </div>
            ) : (
              <>
                {conversationHistory.map((msg, i) => (
                  <MessageBubble key={i} message={msg} />
                ))}
                {loading && <TypingIndicator />}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about your emails..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={!authenticated || loading}
              />
              <button
                type="submit"
                disabled={!authenticated || !query.trim() || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '...' : 'Send'}
              </button>
            </form>
            {!authenticated && (
              <p className="text-xs text-gray-500 mt-2">
                Please login with Microsoft to enable search
              </p>
            )}
          </div>
        </>
      )}

      {/* Error display (only in chat mode) */}
      {viewMode === 'chat' && error && (
        <div className="absolute bottom-20 left-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg">
          {error}
        </div>
      )}

      {/* Tool trace (collapsible, only show when there are results and in chat mode) */}
      {viewMode === 'chat' && response && response.toolTrace.length > 0 && (
        <details className="mx-4 mt-2 text-xs">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            Tool trace ({response.toolTrace.length} tools)
          </summary>
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {response.toolTrace.map((entry, index) => (
              <div key={index} className="bg-gray-50 rounded p-2">
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  entry.outputs?.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {entry.tool}
                </span>
                <span className="text-gray-500 ml-2">({entry.duration}ms)</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
