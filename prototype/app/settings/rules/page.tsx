'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Badge, Card, Toggle, Modal, Select, useToast, ToastContainer } from '@/components/ui';

// Types
interface PriorityRule {
  id: string;
  name: string;
  type: 'sender' | 'subject' | 'body';
  pattern: string;
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
  caseInsensitive: boolean;
  createdAt: number;
}

export default function RulesPage() {
  const [rules, setRules] = useState<PriorityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [newRule, setNewRule] = useState({
    name: '',
    type: 'sender' as const,
    pattern: '',
    priority: 'medium' as const,
    caseInsensitive: true,
  });

  const { toasts, success, error, removeToast } = useToast();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      // For now, use mock data since priority rules API may not exist yet
      setRules([
        {
          id: '1',
          name: 'Boss emails',
          type: 'sender',
          pattern: 'boss@company.com',
          priority: 'high',
          enabled: true,
          caseInsensitive: true,
          createdAt: Date.now(),
        },
        {
          id: '2',
          name: 'Urgent subjects',
          type: 'subject',
          pattern: 'URGENT*',
          priority: 'high',
          enabled: true,
          caseInsensitive: true,
          createdAt: Date.now(),
        },
      ]);
    } catch (err) {
      error('Failed to load rules');
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

    const rule: PriorityRule = {
      id: `rule-${Date.now()}`,
      ...newRule,
      enabled: true,
      createdAt: Date.now(),
    };

    setRules((prev) => [...prev, rule]);
    setShowAddModal(false);
    setNewRule({
      name: '',
      type: 'sender',
      pattern: '',
      priority: 'medium',
      caseInsensitive: true,
    });
    success('Rule added');
  };

  const handleDeleteRule = async (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    success('Rule deleted');
  };

  const priorityColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-gray-100 text-gray-600',
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading rules...
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Priority Rules</h2>
          <p className="text-sm text-gray-500">
            Automatically assign priority to incoming emails
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>Add Rule</Button>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <Card>
            <p className="text-gray-500 text-sm text-center py-4">
              No priority rules configured. Add a rule to automatically prioritize emails.
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
                      <Badge variant={rule.priority as 'high' | 'medium' | 'low'}>
                        {rule.priority}
                      </Badge>
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

      {/* Add Rule Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Priority Rule"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Rule Name"
            placeholder="e.g., Boss emails"
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
            placeholder="e.g., boss@company.com or URGENT*"
            value={newRule.pattern}
            onChange={(e) => setNewRule((prev) => ({ ...prev, pattern: e.target.value }))}
            helperText="Use * for any characters, ? for single character"
          />

          <Select
            label="Priority"
            value={newRule.priority}
            onChange={(e) => setNewRule((prev) => ({ ...prev, priority: e.target.value as any }))}
            options={[
              { value: 'high', label: 'High priority (red)' },
              { value: 'medium', label: 'Medium priority (yellow)' },
              { value: 'low', label: 'Low priority (gray)' },
            ]}
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
            <Button onClick={handleAddRule}>Add Rule</Button>
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
