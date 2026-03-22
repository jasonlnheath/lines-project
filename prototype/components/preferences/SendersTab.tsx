'use client';

import { useState } from 'react';
import { Button, Input, Card, Toggle, Modal } from '@/components/ui';

interface SenderPreference {
  id: string;
  value: string;           // email or phone
  name?: string;           // display name
  isDomain: boolean;
  isBoss: boolean;
  isVIP: boolean;
  mode: 'push' | 'pull';
  createdAt: number;
}

interface SendersTabProps {
  preferences: SenderPreference[];
  onAdd: (pref: Omit<SenderPreference, 'id' | 'createdAt'>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<SenderPreference>) => Promise<void>;
}

export function SendersTab({ preferences, onAdd, onDelete, onUpdate }: SendersTabProps) {
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<'push' | 'pull'>('pull');
  const [newIsBoss, setNewIsBoss] = useState(false);
  const [newIsVIP, setNewIsVIP] = useState(false);
  const [newIsDomain, setNewIsDomain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleAdd = async () => {
    if (!newEmail) return;
    setLoading(true);
    try {
      await onAdd({
        value: newEmail.toLowerCase(),
        name: newName || undefined,
        isDomain: newIsDomain,
        isBoss: newIsBoss,
        isVIP: newIsVIP,
        mode: (newIsBoss || newIsVIP) ? 'push' : newMode,
      });
      setNewEmail('');
      setNewName('');
      setNewIsBoss(false);
      setNewIsVIP(false);
      setNewIsDomain(false);
      setNewMode('pull');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setLoading(true);
    try {
      await onDelete(itemToDelete.id);
    } finally {
      setLoading(false);
      setDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  // Sort: Boss first, then VIP, then alphabetically by name/value
  const sortedPreferences = [...preferences].sort((a, b) => {
    if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1;
    if (a.isVIP !== b.isVIP) return a.isVIP ? -1 : 1;
    return (a.name || a.value).localeCompare(b.name || b.value);
  });

  // Extract display name from email or use provided name
  const getDisplayName = (pref: SenderPreference): string => {
    if (pref.name) return pref.name;
    // Extract name from email (e.g., "john.smith@company.com" -> "John Smith")
    const localPart = pref.value.split('@')[0];
    if (localPart && !pref.isDomain) {
      return localPart
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }
    return pref.value;
  };

  // Determine if value is a phone number
  const isPhoneNumber = (value: string): boolean => {
    return /^[\d\s\-\+\(\)]+$/.test(value.replace('*', ''));
  };

  return (
    <div className="space-y-6">
      {/* Add Sender Card */}
      <Card title="Add Sender Preference">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Name (optional)"
              placeholder="John Smith"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              helperText="Display name for this sender"
            />
            <Input
              label="Email or Phone"
              placeholder={newIsDomain ? "@company.com" : isPhoneNumber(newEmail) ? "+1-555-1234" : "sender@example.com"}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              helperText={
                newIsDomain
                  ? "Domain wildcard: all emails from this domain"
                  : "Email address or phone number"
              }
            />
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Domain toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsDomain}
                onChange={(e) => setNewIsDomain(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Domain wildcard</span>
            </label>

            {/* Boss toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsBoss}
                onChange={(e) => {
                  const isBoss = e.target.checked;
                  setNewIsBoss(isBoss);
                  if (isBoss) {
                    setNewIsVIP(false); // Boss supersedes VIP
                    setNewMode('push');
                  }
                }}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 font-medium">Boss</span>
              <span className="text-xs text-gray-500">(highest priority)</span>
            </label>

            {/* VIP toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsVIP}
                onChange={(e) => {
                  const isVIP = e.target.checked;
                  setNewIsVIP(isVIP);
                  if (isVIP) {
                    setNewIsBoss(false); // Can't be both
                    setNewMode('push');
                  }
                }}
                disabled={newIsBoss}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">VIP</span>
            </label>
          </div>

          {/* Mode toggle (disabled if Boss or VIP) */}
          {!newIsBoss && !newIsVIP && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Mode:</span>
              <Toggle
                checked={newMode === 'push'}
                onChange={(checked) => setNewMode(checked ? 'push' : 'pull')}
                label={newMode === 'push' ? 'Push (immediate)' : 'Pull (queued)'}
              />
            </div>
          )}

          <Button onClick={handleAdd} disabled={!newEmail || loading}>
            Add Preference
          </Button>
        </div>
      </Card>

      {/* Preferences Table */}
      <Card title={`Sender Preferences (${preferences.length})`}>
        {preferences.length === 0 ? (
          <p className="text-gray-500 text-sm">No sender preferences configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-500 w-20">Boss/VIP</th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-500 w-24">Push/Pull</th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-500">Name</th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-500">Email/Phone</th>
                  <th className="text-right py-2 px-2 text-sm font-medium text-gray-500 w-20">Remove</th>
                </tr>
              </thead>
              <tbody>
                {sortedPreferences.map((pref) => (
                  <tr key={pref.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {/* Boss/VIP Column */}
                    <td className="py-2 px-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => onUpdate(pref.id, {
                            isBoss: !pref.isBoss,
                            ...(pref.isBoss ? {} : { isVIP: false, mode: 'push' })
                          })}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            pref.isBoss
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          title="Toggle Boss status"
                        >
                          Boss
                        </button>
                        <button
                          onClick={() => onUpdate(pref.id, {
                            isVIP: !pref.isVIP,
                            ...(pref.isVIP ? {} : { isBoss: false, mode: 'push' })
                          })}
                          disabled={pref.isBoss}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            pref.isVIP
                              ? 'bg-yellow-100 text-yellow-700'
                              : pref.isBoss
                              ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          title="Toggle VIP status"
                        >
                          VIP
                        </button>
                      </div>
                    </td>

                    {/* Push/Pull Column */}
                    <td className="py-2 px-2">
                      <Toggle
                        checked={pref.mode === 'push'}
                        onChange={(checked) => onUpdate(pref.id, { mode: checked ? 'push' : 'pull' })}
                        disabled={pref.isBoss || pref.isVIP}
                        size="sm"
                      />
                    </td>

                    {/* Name Column */}
                    <td className="py-2 px-2 text-sm text-gray-900">
                      {getDisplayName(pref)}
                    </td>

                    {/* Email/Phone Column */}
                    <td className="py-2 px-2 text-sm text-gray-600">
                      <span className={pref.isDomain ? 'italic' : ''}>
                        {pref.isDomain ? `*${pref.value}` : pref.value}
                      </span>
                      {pref.isDomain && (
                        <span className="ml-2 text-xs text-gray-400">(domain)</span>
                      )}
                    </td>

                    {/* Remove Column */}
                    <td className="py-2 px-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setItemToDelete({ id: pref.id, name: getDisplayName(pref) });
                          setDeleteModalOpen(true);
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Delete"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Remove preference for <strong>{itemToDelete?.name}</strong>?
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
    </div>
  );
}
