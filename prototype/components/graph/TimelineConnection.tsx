/**
 * TimelineConnection Component
 * SVG connection lines between timeline messages
 */

interface TimelineConnectionProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  messageHeight: number;
  type?: 'thread' | 'reply' | 'forward' | 'related';
}

const connectionColors = {
  thread: '#3b82f6',   // blue
  reply: '#10b981',    // green
  forward: '#f59e0b',  // amber
  related: '#6b7280',  // gray
};

export function TimelineConnection({
  from,
  to,
  messageHeight,
  type = 'thread',
}: TimelineConnectionProps) {
  const color = connectionColors[type];

  // Calculate curve control points for smooth bezier curve
  const midX = (from.x + to.x) / 2;

  // Y positions (center of message bubbles)
  const fromY = from.y + messageHeight / 2;
  const toY = to.y + messageHeight / 2;

  // Create a smooth S-curve
  const path = `
    M ${from.x} ${fromY}
    C ${midX} ${fromY}, ${midX} ${toY}, ${to.x} ${toY}
  `;

  return (
    <g>
      {/* Shadow for depth */}
      <path
        d={path}
        fill="none"
        stroke="rgba(0,0,0,0.1)"
        strokeWidth={3}
        strokeLinecap="round"
        transform="translate(1, 1)"
      />

      {/* Main connection line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={type === 'related' ? '4,4' : 'none'}
      />

      {/* Arrow head at destination */}
      <circle
        cx={to.x}
        cy={toY}
        r={4}
        fill={color}
      />

      {/* Start indicator */}
      <circle
        cx={from.x}
        cy={fromY}
        r={3}
        fill="white"
        stroke={color}
        strokeWidth={2}
      />
    </g>
  );
}

// Multiple connections component
interface TimelineConnectionsProps {
  connections: Array<{
    fromId: string;
    toId: string;
    fromPos: { x: number; y: number };
    toPos: { x: number; y: number };
    type?: 'thread' | 'reply' | 'forward' | 'related';
  }>;
  messageHeight: number;
}

export function TimelineConnections({ connections, messageHeight }: TimelineConnectionsProps) {
  return (
    <g>
      {connections.map((conn, index) => (
        <TimelineConnection
          key={`${conn.fromId}-${conn.toId}-${index}`}
          from={conn.fromPos}
          to={conn.toPos}
          messageHeight={messageHeight}
          type={conn.type}
        />
      ))}
    </g>
  );
}
