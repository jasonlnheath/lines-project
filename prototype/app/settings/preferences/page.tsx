'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Badge, Card, useToast, ToastContainer } from '@/components/ui';
import { SendersTab, ConversationsTab } from '@/components/preferences';

// Types
interface SenderPreference {
  id: string;
  value: string;
  name?: string;
  isDomain: boolean;
  isBoss: boolean;
  isVIP: boolean;
  mode: 'push' | 'pull';
  createdAt: number;
}

interface Line {
  id: string;
  name: string;
  emailCount: number;
  threadCount: number;
  mode: 'push' | 'pull';
}

interface UnassignedConversation {
  id: string;
  type: 'thread' | 'text' | 'voicemail';
  preview: string;
  emailCount: number;
  mode: 'push' | 'pull';
}

export default function PreferencesPage() {
  // State
  const [senderPreferences, setSenderPreferences] = useState<SenderPreference[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'senders' | 'conversations'>('senders');

  // Toast notifications
  const { toasts, success, error, removeToast } = useToast();

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load sender preferences (including migrated VIP)
      const sendersRes = await fetch('/api/pushpull/preferences?type=sender');
      if (sendersRes.ok) {
        const data = await sendersRes.json();
        // Transform to SenderPreference format
        const prefs = (data.preferences || []).map((p: any) => ({
          id: p.id,
          value: p.value,
          name: p.name,
          isDomain: p.value.startsWith('*@') || p.value.startsWith('@'),
          isBoss: p.isBoss || false,
          isVIP: p.isVIP || false,
          mode: p.mode,
          createdAt: p.createdAt,
        }));
        setSenderPreferences(prefs);
      }

      // Load lines with preferences
      const [linesRes, prefsRes] = await Promise.all([
        fetch('/api/graph/topics'),
        fetch('/api/pushpull/preferences'),
      ]);

      if (linesRes.ok && prefsRes.ok) {
        const linesData = await linesRes.json();
        const prefsData = await prefsRes.json();

        // Map line preferences
        const linePrefs = new Map(
          (prefsData.preferences || [])
            .filter((p: any) => p.type === 'line')
            .map((p: any) => [p.value, p.mode])
        );

        const formattedLines: Line[] = (linesData.lines || []).map((line: any) => ({
          id: line.id,
          name: line.name,
          emailCount: line.emailIds?.length || 0,
          threadCount: 1, // TODO: calculate actual thread count
          mode: linePrefs.get(line.id) || 'pull',
        }));

        setLines(formattedLines);

        // TODO: Load unassigned conversations
        // For now, show thread preferences as unassigned
        const threadPrefs = (prefsData.preferences || [])
          .filter((p: any) => p.type === 'thread')
          .map((p: any) => ({
            id: p.id,
            type: 'thread' as const,
            preview: p.value.substring(0, 50) + '...',
            emailCount: 1,
            mode: p.mode,
          }));

        setUnassigned(threadPrefs);
      }
    } catch (err) {
      error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [error]);

  // Sender handlers
  const handleAddSender = useCallback(async (pref: Omit<SenderPreference, 'id' | 'createdAt'>) => {
    try {
      const res = await fetch('/api/pushpull/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sender',
          value: pref.value,
          name: pref.name,
          mode: (pref.isBoss || pref.isVIP) ? 'push' : pref.mode,
          isBoss: pref.isBoss,
          isVIP: pref.isVIP,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSenderPreferences((prev) => [...prev, {
          id: data.preference.id,
          value: pref.value,
          name: pref.name,
          isDomain: pref.isDomain,
          isBoss: pref.isBoss,
          isVIP: pref.isVIP,
          mode: (pref.isBoss || pref.isVIP) ? 'push' : pref.mode,
          createdAt: Date.now(),
        }]);
        success('Sender preference added');
      } else {
        const data = await res.json();
        error(data.error || 'Failed to add preference');
      }
    } catch (err) {
      error('Failed to add preference');
    }
  }, [success, error]);

  const handleDeleteSender = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/pushpull/preferences/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSenderPreferences((prev) => prev.filter((p) => p.id !== id));
        success('Preference removed');
      } else {
        error('Failed to remove preference');
      }
    } catch (err) {
      error('Failed to remove preference');
    }
  }, [success, error]);

  const handleUpdateSender = useCallback(async (id: string, updates: Partial<SenderPreference>) => {
    try {
      const pref = senderPreferences.find((p) => p.id === id);
      if (!pref) return;

      // Prepare updates - if setting Boss or VIP, ensure mode is push
      const apiUpdates = { ...updates };
      if (updates.isBoss === true || updates.isVIP === true) {
        apiUpdates.mode = 'push';
      }

      const res = await fetch(`/api/pushpull/preferences/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiUpdates),
      });

      if (res.ok) {
        setSenderPreferences((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, ...apiUpdates }
              : p
          )
        );
        success('Preference updated');
      } else {
        const data = await res.json();
        error(data.error || 'Failed to update preference');
      }
    } catch (err) {
      error('Failed to update preference');
    }
  }, [senderPreferences, success, error]);

  // Line handlers
  const handleLineModeChange = useCallback(async (lineId: string, mode: 'push' | 'pull') => {
    try {
      // Use POST which will update existing or create new
      const res = await fetch('/api/pushpull/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'line',
          value: lineId,
          mode,
        }),
      });

      if (res.ok) {
        // Update local state immediately for responsive UI
        setLines((prev) =>
          prev.map((l) => (l.id === lineId ? { ...l, mode } : l))
        );
        success(`Line set to ${mode}`);
      } else {
        const data = await res.json();
        error(data.error || 'Failed to update line preference');
      }
    } catch (err) {
      error('Failed to update line preference');
    }
  }, [success, error]);

  const handleCreateLine = useCallback(async (name: string) => {
    try {
      const res = await fetch('/api/graph/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name,
          emailIds: [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLines((prev) => [
          ...prev,
          {
            id: data.line.id,
            name: data.line.name,
            emailCount: 0,
            threadCount: 0,
            mode: 'pull',
          },
        ]);
        success('Line created');
      } else {
        error('Failed to create line');
      }
    } catch (err) {
      error('Failed to create line');
    }
  }, [success, error]);

  // Unassigned handlers
  const handleUnassignedModeChange = useCallback(async (id: string, mode: 'push' | 'pull') => {
    try {
      const res = await fetch(`/api/pushpull/preferences/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });

      if (res.ok) {
        setUnassigned((prev) =>
          prev.map((u) => (u.id === id ? { ...u, mode } : u))
        );
        success(`Conversation set to ${mode}`);
      } else {
        error('Failed to update preference');
      }
    } catch (err) {
      error('Failed to update preference');
    }
  }, [success, error]);

  const handleAssignToLine = useCallback(async (unassignedId: string, lineId: string) => {
    // TODO: Implement actual assignment logic
    // For now, just remove from unassigned
    setUnassigned((prev) => prev.filter((u) => u.id !== unassignedId));
    success('Conversation assigned to line');
  }, [success]);

  const handleDeleteUnassigned = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/pushpull/preferences/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUnassigned((prev) => prev.filter((u) => u.id !== id));
        success('Preference removed');
      } else {
        error('Failed to remove preference');
      }
    } catch (err) {
      error('Failed to remove preference');
    }
  }, [success, error]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading preferences...
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'senders' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('senders')}
          size="sm"
        >
          Senders
        </Button>
        <Button
          variant={activeTab === 'conversations' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('conversations')}
          size="sm"
        >
          Conversations
        </Button>
      </div>

      {/* Default Mode Indicator */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Default Mode:</span>
          <Badge variant="pull">Pull</Badge>
          <span className="text-xs text-gray-500">
            (Unknown emails go to pull queue)
          </span>
        </div>
      </div>

      {/* Senders Tab */}
      {activeTab === 'senders' && (
        <SendersTab
          preferences={senderPreferences}
          onAdd={handleAddSender}
          onDelete={handleDeleteSender}
          onUpdate={handleUpdateSender}
        />
      )}

      {/* Conversations Tab */}
      {activeTab === 'conversations' && (
        <ConversationsTab
          lines={lines}
          unassigned={unassigned}
          onLineModeChange={handleLineModeChange}
          onUnassignedModeChange={handleUnassignedModeChange}
          onAssignToLine={handleAssignToLine}
          onCreateLine={handleCreateLine}
          onDeleteUnassigned={handleDeleteUnassigned}
        />
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
