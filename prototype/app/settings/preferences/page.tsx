'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Badge, Card, Toggle, Modal, TextArea, useToast, ToastContainer } from '@/components/ui';
import { useMutation, useFetch } from '@/lib/hooks/useApi';

// Types
interface Preference {
  id: string;
  type: 'sender' | 'subject';
  value: string;
  mode: 'push' | 'pull';
  createdAt: number;
}

interface VIPSender {
  id: string;
  email: string;
  domain?: string;
  createdAt: number;
}

export default function PreferencesPage() {
  // State
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [vipSenders, setVIPSenders] = useState<VIPSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sender' | 'subject' | 'vip'>('sender');

  // Form state
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderMode, setNewSenderMode] = useState<'push' | 'pull'>('pull');
  const [newSubjectPattern, setNewSubjectPattern] = useState('');
  const [newSubjectMode, setNewSubjectMode] = useState<'push' | 'pull'>('pull');
  const [newVIPEmail, setNewVIPEmail] = useState('');
  const [newVIPDomain, setNewVIPDomain] = useState('');

  // Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: string; id: string } | null>(null);

  // Duplicate preference state
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateData, setDuplicateData] = useState<{
    type: 'sender' | 'subject';
    value: string;
    mode: 'push' | 'pull';
    existing: { id: string; mode: string; value: string } | null;
  } | null>(null);

  // Force update state (for updating existing preferences)
  const [forceUpdateModalOpen, setForceUpdateModalOpen] = useState(false);

  // Toast notifications
  const { toasts, success, error, removeToast } = useToast();

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prefsRes, vipRes] = await Promise.all([
        fetch('/api/pushpull/preferences'),
        fetch('/api/pushpull/vip'),
      ]);

      if (prefsRes.ok) {
        const prefsData = await prefsRes.json();
        setPreferences(prefsData.preferences || []);
      }

      if (vipRes.ok) {
        const vipData = await vipRes.json();
        setVIPSenders(vipData.vipSenders || []);
      }
    } catch (err) {
      error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  // Add sender preference
  const handleAddSender = async () => {
    if (!newSenderEmail) return;

    try {
      const res = await fetch('/api/pushpull/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sender',
          value: newSenderEmail,
          mode: newSenderMode,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPreferences((prev) => [...prev, data.preference]);
        setNewSenderEmail('');
        success('Sender preference added');
      } else if (res.status === 409 && data.code === 'DUPLICATE_PREFERENCE') {
        // Show duplicate confirmation modal
        setDuplicateData({
          type: 'sender',
          value: newSenderEmail,
          mode: newSenderMode,
          existing: data.existingPreference,
        });
        setDuplicateModalOpen(true);
      } else {
        error(data.error || 'Failed to add preference');
      }
    } catch (err) {
      error('Failed to add preference');
    }
  };

  // Add subject preference
  const handleAddSubject = async () => {
    if (!newSubjectPattern) return;

    try {
      const res = await fetch('/api/pushpull/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subject',
          value: newSubjectPattern,
          mode: newSubjectMode,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPreferences((prev) => [...prev, data.preference]);
        setNewSubjectPattern('');
        success('Subject pattern added');
      } else if (res.status === 409 && data.code === 'DUPLICATE_PREFERENCE') {
        // Show duplicate confirmation modal
        setDuplicateData({
          type: 'subject',
          value: newSubjectPattern,
          mode: newSubjectMode,
          existing: data.existingPreference,
        });
        setDuplicateModalOpen(true);
      } else {
        error(data.error || 'Failed to add preference');
      }
    } catch (err) {
      error('Failed to add preference');
    }
  };

  // Handle duplicate confirmation - force update
  const handleForceUpdate = async () => {
    if (!duplicateData) return;

    try {
      // First delete the existing preference
      if (duplicateData.existing) {
        await fetch(`/api/pushpull/preferences/${duplicateData.existing.id}`, {
          method: 'DELETE',
        });
        setPreferences((prev) => prev.filter((p) => p.id !== duplicateData.existing!.id));
      }

      // Then add the new one
      const res = await fetch('/api/pushpull/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: duplicateData.type,
          value: duplicateData.value,
          mode: duplicateData.mode,
          force: true, // Allow force creation
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPreferences((prev) => [...prev, data.preference]);

        if (duplicateData.type === 'sender') {
          setNewSenderEmail('');
        } else {
          setNewSubjectPattern('');
        }

        success('Preference updated');
      } else {
        error('Failed to update preference');
      }
    } catch (err) {
      error('Failed to update preference');
    } finally {
      setDuplicateModalOpen(false);
      setDuplicateData(null);
    }
  };

  // Add VIP sender
  const handleAddVIP = async () => {
    if (!newVIPEmail) return;

    try {
      const res = await fetch('/api/pushpull/vip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newVIPEmail,
          domain: newVIPDomain || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setVIPSenders((prev) => [...prev, data.vipSender]);
        setNewVIPEmail('');
        setNewVIPDomain('');
        success('VIP sender added');
      } else {
        const data = await res.json();
        error(data.error || 'Failed to add VIP sender');
      }
    } catch (err) {
      error('Failed to add VIP sender');
    }
  };

  // Delete preference
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      const endpoint =
        itemToDelete.type === 'vip'
          ? `/api/pushpull/vip/${itemToDelete.id}`
          : `/api/pushpull/preferences/${itemToDelete.id}`;

      const res = await fetch(endpoint, { method: 'DELETE' });

      if (res.ok) {
        if (itemToDelete.type === 'vip') {
          setVIPSenders((prev) => prev.filter((v) => v.id !== itemToDelete.id));
        } else {
          setPreferences((prev) => prev.filter((p) => p.id !== itemToDelete.id));
        }
        success('Item deleted');
      } else {
        error('Failed to delete');
      }
    } catch (err) {
      error('Failed to delete');
    } finally {
      setDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  // Filter preferences by type (deduplicate by value to prevent React key warnings)
  const senderPreferences = Object.values(
    preferences
      .filter((p) => p.type === 'sender')
      .reduce((acc, p) => {
        const key = p.value.toLowerCase();
        if (!acc[key]) acc[key] = p;
        return acc;
      }, {} as Record<string, typeof preferences[0]>)
  );
  const subjectPreferences = Object.values(
    preferences
      .filter((p) => p.type === 'subject')
      .reduce((acc, p) => {
        const key = p.value.toLowerCase();
        if (!acc[key]) acc[key] = p;
        return acc;
      }, {} as Record<string, typeof preferences[0]>)
  );

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
          variant={activeTab === 'sender' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('sender')}
          size="sm"
        >
          Sender Preferences
        </Button>
        <Button
          variant={activeTab === 'subject' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('subject')}
          size="sm"
        >
          Subject Patterns
        </Button>
        <Button
          variant={activeTab === 'vip' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('vip')}
          size="sm"
        >
          VIP Senders
        </Button>
      </div>

      {/* Default Mode Indicator */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Default Mode:</span>
          <Badge variant="pull">Pull</Badge>
          <span className="text-xs text-gray-500">
            (Emails from unknown senders are queued)
          </span>
        </div>
      </div>

      {/* Sender Preferences Tab */}
      {activeTab === 'sender' && (
        <div className="space-y-6">
          {/* Add Form */}
          <Card title="Add Sender Preference">
            <div className="space-y-4">
              <Input
                label="Email Address"
                placeholder="sender@example.com"
                value={newSenderEmail}
                onChange={(e) => setNewSenderEmail(e.target.value)}
              />
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Mode:</span>
                <Toggle
                  checked={newSenderMode === 'push'}
                  onChange={(checked) => setNewSenderMode(checked ? 'push' : 'pull')}
                  label={newSenderMode === 'push' ? 'Push (immediate)' : 'Pull (queued)'}
                />
              </div>
              <Button onClick={handleAddSender} disabled={!newSenderEmail}>
                Add Preference
              </Button>
            </div>
          </Card>

          {/* List */}
          <Card title={`Sender Preferences (${senderPreferences.length})`}>
            {senderPreferences.length === 0 ? (
              <p className="text-gray-500 text-sm">No sender preferences configured.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {senderPreferences.map((pref) => (
                  <div
                    key={pref.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={pref.mode}>{pref.mode}</Badge>
                      <span className="text-sm text-gray-900">{pref.value}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setItemToDelete({ type: 'preference', id: pref.id });
                        setDeleteModalOpen(true);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Subject Patterns Tab */}
      {activeTab === 'subject' && (
        <div className="space-y-6">
          <Card title="Add Subject Pattern">
            <div className="space-y-4">
              <Input
                label="Subject Pattern"
                placeholder="Urgent * or Project * Update"
                helperText="Use * for any characters, ? for single character"
                value={newSubjectPattern}
                onChange={(e) => setNewSubjectPattern(e.target.value)}
              />
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Mode:</span>
                <Toggle
                  checked={newSubjectMode === 'push'}
                  onChange={(checked) => setNewSubjectMode(checked ? 'push' : 'pull')}
                  label={newSubjectMode === 'push' ? 'Push (immediate)' : 'Pull (queued)'}
                />
              </div>
              <Button onClick={handleAddSubject} disabled={!newSubjectPattern}>
                Add Pattern
              </Button>
            </div>
          </Card>

          <Card title={`Subject Patterns (${subjectPreferences.length})`}>
            {subjectPreferences.length === 0 ? (
              <p className="text-gray-500 text-sm">No subject patterns configured.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {subjectPreferences.map((pref) => (
                  <div
                    key={pref.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={pref.mode}>{pref.mode}</Badge>
                      <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">
                        {pref.value}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setItemToDelete({ type: 'preference', id: pref.id });
                        setDeleteModalOpen(true);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* VIP Senders Tab */}
      {activeTab === 'vip' && (
        <div className="space-y-6">
          <Card title="Add VIP Sender">
            <div className="space-y-4">
              <Input
                label="Email Address"
                placeholder="boss@company.com"
                value={newVIPEmail}
                onChange={(e) => setNewVIPEmail(e.target.value)}
              />
              <Input
                label="Domain Wildcard (optional)"
                placeholder="@company.com"
                helperText="All emails from this domain will trigger push"
                value={newVIPDomain}
                onChange={(e) => setNewVIPDomain(e.target.value)}
              />
              <Button onClick={handleAddVIP} disabled={!newVIPEmail}>
                Add VIP Sender
              </Button>
            </div>
          </Card>

          <Card title={`VIP Senders (${vipSenders.length})`}>
            {vipSenders.length === 0 ? (
              <p className="text-gray-500 text-sm">No VIP senders configured.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {vipSenders.map((vip) => (
                  <div
                    key={vip.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="push">VIP</Badge>
                      <span className="text-sm text-gray-900">{vip.email}</span>
                      {vip.domain && (
                        <span className="text-xs text-gray-500">
                          (includes {vip.domain})
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setItemToDelete({ type: 'vip', id: vip.id });
                        setDeleteModalOpen(true);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Delete"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to remove this item?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Duplicate Preference Confirmation Modal */}
      <Modal
        isOpen={duplicateModalOpen}
        onClose={() => {
          setDuplicateModalOpen(false);
          setDuplicateData(null);
        }}
        title="Preference Already Exists"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            A preference for <strong>{duplicateData?.value}</strong> already exists
            with mode <Badge variant={duplicateData?.existing?.mode as 'push' | 'pull'}>
              {duplicateData?.existing?.mode}
            </Badge>.
          </p>
          <p className="text-sm text-gray-600">
            Do you want to update it to <Badge variant={duplicateData?.mode as 'push' | 'pull'}>
              {duplicateData?.mode}
            </Badge>?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => {
              setDuplicateModalOpen(false);
              setDuplicateData(null);
            }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleForceUpdate}>
              Update Preference
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
