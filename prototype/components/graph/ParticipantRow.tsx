/**
 * ParticipantRow Component
 * Displays email participants with color-coded badges (To/Cc/Bcc)
 * Collapsed by default with overflow chip
 */

'use client';

import { useState, useMemo } from 'react';
import { SenderAvatarCompact } from './SenderAvatar';

interface ParticipantRowProps {
  from: string;
  fromName?: string;
  to: string[];
  toNames?: Record<string, string>;
  cc?: string[];
  ccNames?: Record<string, string>;
  bcc?: string[];
  bccNames?: Record<string, string>;
  maxVisible?: number;
  className?: string;
}

type ParticipantType = 'from' | 'to' | 'cc' | 'bcc';

interface Participant {
  email: string;
  name?: string;
  type: ParticipantType;
}

const typeColors: Record<ParticipantType, string> = {
  from: 'bg-purple-100 text-purple-700 border-purple-200',
  to: 'bg-blue-100 text-blue-700 border-blue-200',
  cc: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  bcc: 'bg-gray-100 text-gray-600 border-gray-200',
};

const typeLabels: Record<ParticipantType, string> = {
  from: 'From',
  to: 'To',
  cc: 'Cc',
  bcc: 'Bcc',
};

export function ParticipantRow({
  from,
  fromName,
  to,
  toNames = {},
  cc = [],
  ccNames = {},
  bcc = [],
  bccNames = {},
  maxVisible = 5,
  className = '',
}: ParticipantRowProps) {
  const [expanded, setExpanded] = useState(false);

  // Build participant list
  const participants = useMemo<Participant[]>(() => {
    const list: Participant[] = [
      { email: from, name: fromName, type: 'from' },
    ];

    to.forEach(email => {
      list.push({ email, name: toNames[email], type: 'to' });
    });

    cc.forEach(email => {
      list.push({ email, name: ccNames[email], type: 'cc' });
    });

    bcc.forEach(email => {
      list.push({ email, name: bccNames[email], type: 'bcc' });
    });

    return list;
  }, [from, fromName, to, toNames, cc, ccNames, bcc, bccNames]);

  const visibleParticipants = expanded ? participants : participants.slice(0, maxVisible);
  const hiddenCount = participants.length - maxVisible;
  const hasOverflow = !expanded && hiddenCount > 0;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {visibleParticipants.map((participant, index) => (
        <div
          key={`${participant.type}-${participant.email}`}
          className="flex items-center gap-1"
        >
          {index > 0 && participant.type !== visibleParticipants[index - 1].type && (
            <span className={`text-xs px-1.5 py-0.5 rounded border ${typeColors[participant.type]}`}>
              {typeLabels[participant.type]}
            </span>
          )}
          <SenderAvatarCompact
            email={participant.email}
            name={participant.name}
            size="sm"
          />
        </div>
      ))}

      {hasOverflow && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-300 transition-colors"
          title={`Show ${hiddenCount} more participants`}
        >
          +{hiddenCount}
        </button>
      )}

      {expanded && participants.length > maxVisible && (
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-blue-600 hover:text-blue-700 underline"
        >
          Show less
        </button>
      )}
    </div>
  );
}

// Compact inline version for timeline bubbles
export function ParticipantRowInline({
  from,
  fromName,
  to,
  toNames = {},
  maxVisible = 3,
}: Pick<ParticipantRowProps, 'from' | 'fromName' | 'to' | 'toNames' | 'maxVisible'>) {
  const visibleTo = to.slice(0, maxVisible);
  const overflowCount = to.length - maxVisible;

  return (
    <div className="flex items-center gap-0.5">
      <SenderAvatarCompact email={from} name={fromName} size="sm" />
      <span className="text-gray-400 mx-1">→</span>
      {visibleTo.map(email => (
        <SenderAvatarCompact key={email} email={email} name={toNames[email]} size="sm" />
      ))}
      {overflowCount > 0 && (
        <span className="text-xs text-gray-500 ml-1">+{overflowCount}</span>
      )}
    </div>
  );
}
