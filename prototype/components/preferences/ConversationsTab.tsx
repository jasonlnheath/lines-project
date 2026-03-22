'use client';

import { useState } from 'react';
import { Button, Input, Badge, Card, Toggle, Modal } from '@/components/ui';

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

interface ConversationsTabProps {
  lines: Line[];
  unassigned: UnassignedConversation[];
  onLineModeChange: (lineId: string, mode: 'push' | 'pull') => Promise<void>;
  onUnassignedModeChange: (id: string, mode: 'push' | 'pull') => Promise<void>;
  onAssignToLine: (unassignedId: string, lineId: string) => Promise<void>;
  onCreateLine: (name: string) => Promise<void>;
  onDeleteUnassigned: (id: string) => Promise<void>;
}

export function ConversationsTab({
  lines,
  unassigned,
  onLineModeChange,
  onUnassignedModeChange,
  onAssignToLine,
  onCreateLine,
  onDeleteUnassigned,
}: ConversationsTabProps) {
  const [activeSection, setActiveSection] = useState<'lines' | 'unassigned'>('lines');
  const [newLineName, setNewLineName] = useState('');
  const [loading, setLoading] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [itemToAssign, setItemToAssign] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const handleCreateLine = async () => {
    if (!newLineName.trim()) return;
    setLoading(true);
    try {
      await onCreateLine(newLineName.trim());
      setNewLineName('');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!itemToAssign || !selectedLineId) return;
    setLoading(true);
    try {
      await onAssignToLine(itemToAssign, selectedLineId);
      setAssignModalOpen(false);
      setItemToAssign(null);
      setSelectedLineId(null);
    } finally {
      setLoading(false);
    }
  };

  const getConversationTypeIcon = (type: string) => {
    switch (type) {
      case 'thread':
        return '📧';
      case 'text':
        return '💬';
      case 'voicemail':
        return '📞';
      default:
        return '📄';
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Toggle */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <Button
          variant={activeSection === 'lines' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveSection('lines')}
        >
          Lines ({lines.length})
        </Button>
        <Button
          variant={activeSection === 'unassigned' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveSection('unassigned')}
        >
          Unassigned ({unassigned.length})
        </Button>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>Preference Hierarchy:</strong> Line preferences override thread preferences.
          Threads not in any Line can have individual preferences.
        </p>
      </div>

      {/* Lines Section */}
      {activeSection === 'lines' && (
        <div className="space-y-4">
          {/* Create New Line */}
          <Card title="Create New Line">
            <div className="flex gap-2">
              <Input
                placeholder="Line name (e.g., House Purchase)"
                value={newLineName}
                onChange={(e) => setNewLineName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleCreateLine} disabled={!newLineName.trim() || loading}>
                Create
              </Button>
            </div>
          </Card>

          {/* Lines List */}
          <Card title={`Lines (${lines.length})`}>
            {lines.length === 0 ? (
              <p className="text-gray-500 text-sm">No lines created yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={line.mode}>{line.mode}</Badge>
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {line.name}
                        </span>
                        <div className="text-xs text-gray-500">
                          {line.threadCount} threads, {line.emailCount} emails
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Toggle
                        checked={line.mode === 'push'}
                        onChange={(checked) => onLineModeChange(line.id, checked ? 'push' : 'pull')}
                        size="sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Unassigned Section */}
      {activeSection === 'unassigned' && (
        <Card title={`Unassigned Conversations (${unassigned.length})`}>
          {unassigned.length === 0 ? (
            <p className="text-gray-500 text-sm">
              All conversations are assigned to lines. Great job!
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {unassigned.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {getConversationTypeIcon(conv.type)}
                    </span>
                    <Badge variant={conv.mode}>{conv.mode}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {conv.preview}
                      </p>
                      <p className="text-xs text-gray-500">
                        {conv.emailCount} emails
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={conv.mode === 'push'}
                      onChange={(checked) => onUnassignedModeChange(conv.id, checked ? 'push' : 'pull')}
                      size="sm"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setItemToAssign(conv.id);
                        setAssignModalOpen(true);
                      }}
                    >
                      Assign to Line
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteUnassigned(conv.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Assign Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setItemToAssign(null);
          setSelectedLineId(null);
        }}
        title="Assign to Line"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a line to assign this conversation to:
          </p>

          {lines.length === 0 ? (
            <p className="text-sm text-yellow-600">
              No lines available. Create a line first.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lines.map((line) => (
                <label
                  key={line.id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                    selectedLineId === line.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="lineSelect"
                    checked={selectedLineId === line.id}
                    onChange={() => setSelectedLineId(line.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{line.name}</span>
                  <Badge variant={line.mode} size="sm">{line.mode}</Badge>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssign}
              disabled={!selectedLineId || loading}
            >
              Assign
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
