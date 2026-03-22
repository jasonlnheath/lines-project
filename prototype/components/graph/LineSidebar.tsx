/**
 * LineSidebar Component
 * Extracted line list from TopicLineView
 * Enables line selection for timeline view
 */

'use client';

import { TopicLine } from '@/services/graph/types';

interface LineSidebarProps {
  lines: TopicLine[];
  selectedLineId: string | null;
  onLineSelect: (line: TopicLine) => void;
  className?: string;
}

export function LineSidebar({
  lines,
  selectedLineId,
  onLineSelect,
  className = '',
}: LineSidebarProps) {
  // Sort lines by date (newest first)
  const sorted = [...lines].sort((a, b) => {
    const dateA = new Date(a.firstEmailDate).getTime();
    const dateB = new Date(b.firstEmailDate).getTime();
    return dateB - dateA;
  });

  return (
    <div className={'flex flex-col gap-2 ' + className}>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Topic Lines</h3>
      <p className="text-xs text-gray-500">
        {lines.length} lines - Click to select one to view timeline
      </p>

      <div className="flex-1 overflow-y-auto space-y-2">
        {sorted.map((line) => (
          <button
            key={line.id}
            onClick={() => onLineSelect(line)}
            className={
              'w-full text-left p-3 rounded-lg border transition-colors ' +
              (selectedLineId === line.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')
            }
          >
            <div className="flex items-center justify-between">
              <span className={'font-medium truncate ' + (selectedLineId === line.id ? 'text-blue-700' : 'text-gray-900')}>
                {line.name}
              </span>
              <span className="text-xs text-gray-500">
                {line.emailIds.length}
              </span>
            </div>

            <p className="text-xs text-gray-500 truncate mt-1">
              {line.description}
            </p>

            {/* Confidence indicator */}
            <div className="mt-2">
              <div className="flex items-center gap-1">
                <div
                  className={
                    'h-1.5 rounded-full transition-all ' +
                    (line.confidence >= 0.8
                      ? 'bg-green-500'
                      : line.confidence >= 0.5
                      ? 'bg-yellow-500'
                      : 'bg-orange-500')
                  }
                  style={{ width: Math.round(line.confidence * 100) + '%' }}
                />
                <span className="text-xs text-gray-400">
                  {Math.round(line.confidence * 100)}%
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
