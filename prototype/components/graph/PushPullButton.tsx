/**
 * Push/Pull Button Component
 *
 * Toggle button for setting push/pull preferences on threads and lines.
 * Allows users to control notification behavior for specific conversations or topics.
 */

'use client';

import { useState, useEffect } from 'react';

interface PushPullButtonProps {
  type: 'thread' | 'line';
  id: string;
  initialMode?: 'push' | 'pull' | null;
  size?: 'sm' | 'md';
  onModeChange?: (mode: 'push' | 'pull') => void;
}

export function PushPullButton({
  type,
  id,
  initialMode = null,
  size = 'sm',
  onModeChange,
}: PushPullButtonProps) {
  const [mode, setMode] = useState<'push' | 'pull' | null>(initialMode);
  const [loading, setLoading] = useState(false);

  // Fetch current preference on mount
  useEffect(() => {
    if (initialMode === null) {
      fetchPreference();
    }
  }, [id, type]);

  const fetchPreference = async () => {
    try {
      const res = await fetch(`/api/pushpull/preferences?type=${type}&value=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.preferences && data.preferences.length > 0) {
          setMode(data.preferences[0].mode);
        }
      }
    } catch (err) {
      console.error('[PushPullButton] Error fetching preference:', err);
    }
  };

  const setPreference = async (newMode: 'push' | 'pull') => {
    setLoading(true);
    try {
      const res = await fetch('/api/pushpull/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          value: id,
          mode: newMode,
        }),
      });

      if (res.ok) {
        setMode(newMode);
        onModeChange?.(newMode);
      }
    } catch (err) {
      console.error('[PushPullButton] Error setting preference:', err);
    } finally {
      setLoading(false);
    }
  };

  const removePreference = async () => {
    setLoading(true);
    try {
      // Get the preference ID first
      const res = await fetch(`/api/pushpull/preferences?type=${type}&value=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.preferences && data.preferences.length > 0) {
          await fetch(`/api/pushpull/preferences/${data.preferences[0].id}`, {
            method: 'DELETE',
          });
          setMode(null);
        }
      }
    } catch (err) {
      console.error('[PushPullButton] Error removing preference:', err);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  if (mode === null) {
    // No preference set - show both options
    return (
      <div className="flex gap-1">
        <button
          onClick={() => setPreference('push')}
          disabled={loading}
          className={`${sizeClasses} rounded border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1`}
          title={`Push this ${type}`}
        >
          <span>🔔</span>
          <span>Push</span>
        </button>
        <button
          onClick={() => setPreference('pull')}
          disabled={loading}
          className={`${sizeClasses} rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1`}
          title={`Pull this ${type}`}
        >
          <span>📥</span>
          <span>Pull</span>
        </button>
      </div>
    );
  }

  if (mode === 'push') {
    return (
      <div className="flex gap-1 items-center">
        <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-blue-600 flex items-center gap-1`}>
          <span>🔔</span>
          <span>Push enabled</span>
        </span>
        <button
          onClick={removePreference}
          disabled={loading}
          className={`${sizeClasses} rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50`}
          title="Remove preference"
        >
          ✕
        </button>
      </div>
    );
  }

  // mode === 'pull'
  return (
    <div className="flex gap-1 items-center">
      <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-gray-500 flex items-center gap-1`}>
        <span>📥</span>
        <span>Pull enabled</span>
      </span>
      <button
        onClick={removePreference}
        disabled={loading}
        className={`${sizeClasses} rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50`}
        title="Remove preference"
      >
        ✕
      </button>
    </div>
  );
}
