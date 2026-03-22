'use client';

import { useState } from 'react';

interface ThreadStats {
  period: string;
  totalEmails: number;
  threadCount: number;
  threads: Array<{
    conversationId: string;
    name: string;
    emailCount: number;
    subjectVariations: string[];
    firstDate: string;
    lastDate: string;
    participants: string[];
  }>;
}

interface ValidationReport {
  summary: {
    threadCount: number;
    lineCount: number;
    perfectMatches: number;
    partialMatches: number;
    missingLines: number;
    nameMatches: number;
    emailsInLines: number;
    totalThreadEmails: number;
  };
  threads: Array<{
    conversationId: string;
    threadName: string;
    threadEmailCount: number;
    matchedLineId: string | null;
    lineName: string | null;
    lineEmailCount: number | null;
    coverage: number;
    matchType: 'perfect' | 'partial' | 'missing' | 'name_mismatch';
    nameMatch: boolean;
  }>;
  unmatchedLines: Array<{
    lineId: string;
    lineName: string;
    emailCount: number;
  }>;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

const matchBadge: Record<string, string> = {
  perfect: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  name_mismatch: 'bg-orange-100 text-orange-800',
  missing: 'bg-red-100 text-red-800',
};

function formatDate(iso: string) {
  return iso ? new Date(iso).toLocaleDateString() : '—';
}

export function LineTestPanel() {
  const [threadStatus, setThreadStatus] = useState<Status>('idle');
  const [validateStatus, setValidateStatus] = useState<Status>('idle');
  const [resetStatus, setResetStatus] = useState<Status>('idle');
  const [threadData, setThreadData] = useState<ThreadStats | null>(null);
  const [validateData, setValidateData] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runThreadStats() {
    setThreadStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/graph/test?action=thread-stats');
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setThreadData(await res.json());
      setThreadStatus('done');
    } catch (e: any) {
      setError(e.message);
      setThreadStatus('error');
    }
  }

  async function runValidation() {
    setValidateStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/graph/test?action=validate-lining');
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setValidateData(await res.json());
      setValidateStatus('done');
    } catch (e: any) {
      setError(e.message);
      setValidateStatus('error');
    }
  }

  async function resetAndValidate() {
    setResetStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/graph/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-and-validate' }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setValidateData(data.validation);
      setResetStatus('done');
    } catch (e: any) {
      setError(e.message);
      setResetStatus('error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-1">Lining Validation</h2>
        <p className="text-sm text-gray-500 mb-4">
          Compare email lining against real Microsoft Graph thread data (last 30 days).
        </p>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={runThreadStats}
            disabled={threadStatus === 'loading'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {threadStatus === 'loading' ? 'Fetching…' : '1. Get Thread Stats (Ground Truth)'}
          </button>
          <button
            onClick={runValidation}
            disabled={validateStatus === 'loading'}
            className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {validateStatus === 'loading' ? 'Validating…' : '2. Validate Lining'}
          </button>
          <button
            onClick={resetAndValidate}
            disabled={resetStatus === 'loading'}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {resetStatus === 'loading' ? 'Resetting…' : '3. Reset & Re-validate (Full Test)'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
        )}
      </div>

      {/* Thread Stats */}
      {threadData && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold mb-1">Thread Stats — Ground Truth</h3>
          <p className="text-sm text-gray-500 mb-4">
            Period: {threadData.period} &nbsp;·&nbsp;
            <strong>{threadData.totalEmails}</strong> emails &nbsp;·&nbsp;
            <strong>{threadData.threadCount}</strong> threads
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2 border border-gray-200 font-medium">#</th>
                  <th className="px-3 py-2 border border-gray-200 font-medium">Thread Name</th>
                  <th className="px-3 py-2 border border-gray-200 font-medium text-center">Emails</th>
                  <th className="px-3 py-2 border border-gray-200 font-medium">First</th>
                  <th className="px-3 py-2 border border-gray-200 font-medium">Last</th>
                  <th className="px-3 py-2 border border-gray-200 font-medium">Participants</th>
                </tr>
              </thead>
              <tbody>
                {threadData.threads.map((t, i) => (
                  <tr key={t.conversationId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 border border-gray-200 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 border border-gray-200 max-w-xs">
                      <span className="font-medium">{t.name}</span>
                      {t.subjectVariations.length > 1 && (
                        <span className="ml-2 text-xs text-gray-400">
                          +{t.subjectVariations.length - 1} variation{t.subjectVariations.length > 2 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center font-mono">{t.emailCount}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-600 whitespace-nowrap">{formatDate(t.firstDate)}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-600 whitespace-nowrap">{formatDate(t.lastDate)}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{t.participants.slice(0, 2).join(', ')}{t.participants.length > 2 ? ` +${t.participants.length - 2}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Validation Report */}
      {validateData && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Lining Validation Report</h3>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Perfect Matches', value: validateData.summary.perfectMatches, color: 'bg-green-50 border-green-200 text-green-800' },
                { label: 'Partial / Name Mismatch', value: validateData.summary.partialMatches, color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
                { label: 'Missing Lines', value: validateData.summary.missingLines, color: 'bg-red-50 border-red-200 text-red-800' },
                { label: 'Unmatched Lines', value: validateData.unmatchedLines.length, color: 'bg-gray-50 border-gray-200 text-gray-700' },
              ].map(card => (
                <div key={card.label} className={`rounded-md border p-3 ${card.color}`}>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <div className="text-xs mt-1">{card.label}</div>
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-600 mb-4">
              <strong>{validateData.summary.threadCount}</strong> threads from Graph &nbsp;·&nbsp;
              <strong>{validateData.summary.lineCount}</strong> lines in storage &nbsp;·&nbsp;
              <strong>{validateData.summary.nameMatches}</strong> name matches
            </p>

            {/* Thread comparison table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-2 border border-gray-200 font-medium">Thread Name (Graph)</th>
                    <th className="px-3 py-2 border border-gray-200 font-medium text-center">Emails</th>
                    <th className="px-3 py-2 border border-gray-200 font-medium">Line Name</th>
                    <th className="px-3 py-2 border border-gray-200 font-medium text-center">Line Emails</th>
                    <th className="px-3 py-2 border border-gray-200 font-medium text-center">Coverage</th>
                    <th className="px-3 py-2 border border-gray-200 font-medium text-center">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {validateData.threads.map((t, i) => (
                    <tr key={t.conversationId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 border border-gray-200 max-w-xs font-medium">{t.threadName}</td>
                      <td className="px-3 py-2 border border-gray-200 text-center font-mono">{t.threadEmailCount}</td>
                      <td className="px-3 py-2 border border-gray-200 max-w-xs text-gray-600">
                        {t.lineName || <span className="text-red-400 italic">no line found</span>}
                      </td>
                      <td className="px-3 py-2 border border-gray-200 text-center font-mono">{t.lineEmailCount ?? '—'}</td>
                      <td className="px-3 py-2 border border-gray-200 text-center">
                        {t.coverage > 0 ? `${Math.round(t.coverage * 100)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 border border-gray-200 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${matchBadge[t.matchType]}`}>
                          {t.matchType.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unmatched lines */}
          {validateData.unmatchedLines.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">
                Lines with no matching thread ({validateData.unmatchedLines.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 border border-gray-200 font-medium">Line Name</th>
                      <th className="px-3 py-2 border border-gray-200 font-medium text-center">Emails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validateData.unmatchedLines.map((c, i) => (
                      <tr key={c.lineId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 border border-gray-200">{c.lineName}</td>
                        <td className="px-3 py-2 border border-gray-200 text-center font-mono">{c.emailCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
