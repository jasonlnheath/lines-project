'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Badge, Card, Toggle, Modal, Select, useToast, ToastContainer } from '@/components/ui';

// Types
interface TriggerRule {
  id: string;
  name: string;
  type: 'sender' | 'subject' | 'body';
  pattern: string;
  enabled: boolean;
  caseInsensitive: boolean;
  createdAt: number;
}

export default function TriggersPage() {
  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [newRule, setNewRule] = useState({
    name: '',
    type: 'subject' as const,
    pattern: '',
    caseInsensitive: true,
  });

  const { toasts, success, error, removeToast } = useToast();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pushpull/triggers');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      } else {
        // Use mock data if API not available
        setRules([
          {
            id: '1',
            name: 'Action required',
            type: 'subject',
            pattern: '[ACTION]*',
            enabled: true,
            caseInsensitive: true,
            createdAt: Date.now(),
          },
        ]);
      }
    } catch (err) {
      error('Failed to load trigger rules');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled } : r))
    );
    success(enabled ? 'Rule enabled' : 'Rule disabled');
  };

  const handleAddRule = async () => {
    if (!newRule.name || !newRule.pattern) {
      error('Name and pattern are required');
      return;
    }

    try {
      const res = await fetch('/api/pushpull/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });

      if (res.ok) {
        const data = await res.json();
        setRules((prev) => [...prev, data.rule]);
        setShowAddModal(false);
        setNewRule({
          name: '',
          type: 'subject',
          pattern: '',
          caseInsensitive: true,
        });
        success('Trigger rule added');
      } else {
        const data = await res.json();
        error(data.error || 'Failed to add rule');
      }
    } catch (err) {
      error('Failed to add trigger rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/pushpull/triggers/${ruleId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
        success('Rule deleted');
      } else {
        error('Failed to delete rule');
      }
    } catch (err) {
      error('Failed to delete rule');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading trigger rules...
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Push Trigger Rules</h2>
          <p className="text-sm text-gray-500">
            Define rules that trigger immediate push notifications
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>Add Trigger</Button>
      </div>

      {/* Default Triggers Info */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-2">Built-in Triggers</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>Emails marked as High Importance</li>
            <li>Emails where you are in the To: field (not CC)</li>
            <li>Emails from VIP senders</li>
            <li>Emails containing time-sensitive keywords (urgent, asap, deadline)</li>
          </ul>
        </div>
      </Card>

      {/* Custom Rules List */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <Card>
            <p className="text-gray-500 text-sm text-center py-4">
              No custom trigger rules. Built-in triggers are always active.
            </p>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className="!p-0">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <Toggle
                    checked={rule.enabled}
                    onChange={(checked) => handleToggleRule(rule.id, checked)}
                    size="sm"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{rule.name}</span>
                      <Badge variant="push">Push</Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className="capitalize">{rule.type}</span>:{" "}
                      <code className="bg-gray-100 px-1 rounded">{rule.pattern}</code>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteRule(rule.id)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add Trigger Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Push Trigger"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Trigger Name"
            placeholder="e.g., Action required emails"
            value={newRule.name}
            onChange={(e) => setNewRule((prev) => ({ ...prev, name: e.target.value }))}
          />

          <Select
            label="Match Type"
            value={newRule.type}
            onChange={(e) => setNewRule((prev) => ({ ...prev, type: e.target.value as any }))}
            options={[
              { value: 'sender', label: 'Sender email' },
              { value: 'subject', label: 'Subject line' },
              { value: 'body', label: 'Email body' },
            ]}
          />

          <Input
            label="Pattern"
            placeholder="e.g., [ACTION]* or urgent"
            value={newRule.pattern}
            onChange={(e) => setNewRule((prev) => ({ ...prev, pattern: e.target.value }))}
            helperText="Use * for any characters, ? for single character"
          />

          <div className="flex items-center gap-2">
            <Toggle
              checked={newRule.caseInsensitive}
              onChange={(checked) => setNewRule((prev) => ({ ...prev, caseInsensitive: checked }))}
              label="Case insensitive"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRule}>Add Trigger</Button>
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
