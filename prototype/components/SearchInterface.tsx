'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

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

export function SearchInterface() {
  const { authenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Conversation state
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [toolResults, setToolResults] = useState<Record<string, any>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim() || loading) return;

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
          query,
          conversationHistory,
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
        return;
      }

      const data: AgentResponse = await res.json();
      setResponse(data);

      // Update conversation state for next request
      if (data.conversationHistory) {
        setConversationHistory(data.conversationHistory);
      }
      if (data.toolResults) {
        setToolResults(data.toolResults);
      }

      // Clear the input after successful query
      setQuery('');
    } catch (err) {
      setError('Failed to connect to the service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
          Search your emails
        </label>
        <div className="flex gap-3">
          <input
            id="search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about your emails... (e.g., 'Show me emails from John about the project')"
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={!authenticated || loading}
          />
          <button
            type="submit"
            disabled={!authenticated || !query.trim() || loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        {!authenticated && (
          <p className="text-sm text-gray-500 mt-2">
            Please login with Microsoft to enable search
          </p>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {response && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-3">Answer</h3>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {response.answer}
            </div>
          </div>

          {response.toolTrace.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Tool Trace ({response.toolTrace.length} tools used)
              </h3>
              <div className="space-y-2">
                {response.toolTrace.map((entry, index) => (
                  <details key={index} className="bg-white rounded border border-gray-200">
                    <summary className="px-3 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {index + 1}. {entry.tool}
                        <span className="text-gray-500 font-normal ml-2">
                          ({entry.duration}ms)
                        </span>
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        entry.outputs?.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {entry.outputs?.success ? 'Success' : 'Failed'}
                      </span>
                    </summary>
                    <div className="px-3 py-2 border-t border-gray-200 text-xs">
                      <div className="mb-2">
                        <span className="font-medium">Inputs:</span>
                        <pre className="mt-1 bg-gray-100 p-2 rounded overflow-x-auto">
                          {JSON.stringify(entry.inputs, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="font-medium">Outputs:</span>
                        <pre className="mt-1 bg-gray-100 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
                          {JSON.stringify(entry.outputs, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Example queries</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• &quot;Show me recent emails from John&quot;</li>
          <li>• &quot;Find emails about the budget review&quot;</li>
          <li>• &quot;What emails have I received this week?&quot;</li>
          <li>• &quot;Summarize the thread about the project deadline&quot;</li>
        </ul>
      </div>
    </div>
  );
}
