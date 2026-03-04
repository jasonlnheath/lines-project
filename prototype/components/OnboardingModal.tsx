/**
 * Onboarding Modal
 * First-time user setup for capturing persona information
 */

'use client';

import { useState } from 'react';

interface OnboardingModalProps {
  onComplete?: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step] = useState(1);
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    // Validation
    if (!role.trim() || !company.trim()) {
      setError('Please fill in both your role and company.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/persona', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: role.trim(),
          company: company.trim(),
          additionalContext: additionalContext.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save persona');
      }

      // Success - reload to show search interface with persona
      if (onComplete) {
        onComplete();
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome to Lines!
          </h2>
          <p className="text-gray-600 mt-2">
            Tell me a bit about yourself so I can provide better assistance with your emails.
          </p>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Role */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Your Role <span className="text-red-500">*</span>
            </label>
            <input
              id="role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Sales Director, Product Manager, CEO"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Company */}
          <div>
            <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
              Company <span className="text-red-500">*</span>
            </label>
            <input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., Walther EMC, Acme Corp"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* Additional Context (Optional) */}
          <div>
            <label htmlFor="context" className="block text-sm font-medium text-gray-700 mb-1">
              Additional Context <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="context"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Any other information that might help me assist you better..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={handleSubmit}
            disabled={!role.trim() || !company.trim() || loading}
            className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Saving...' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  );
}
