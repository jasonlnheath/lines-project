/**
 * SenderAvatar Component
 * Displays user initials or avatar with consistent color coding
 * Enhanced with relationship badges for important contacts
 */

'use client';

import { useMemo } from 'react';

interface SenderAvatarProps {
  email: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  statusColor?: string;
  className?: string;
  // Relationship badges
  relationship?: 'manager' | 'executive' | 'direct_report' | 'vip' | 'customer' | null;
}

// Generate consistent color from email hash
function getEmailColor(email: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-cyan-500',
    'bg-amber-500',
  ];

  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Generate initials from name or email
function getInitials(name: string | undefined, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Fallback to email
  const localPart = email.split('@')[0];
  return localPart.substring(0, 2).toUpperCase();
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

// Badge styles for different relationship types
const relationshipBadgeStyles: Record<string, { bg: string; icon: string; label: string }> = {
  manager: { bg: 'bg-red-500', icon: '👔', label: 'Your Manager' },
  executive: { bg: 'bg-purple-500', icon: '⭐', label: 'Executive' },
  direct_report: { bg: 'bg-blue-500', icon: '👥', label: 'Team Member' },
  vip: { bg: 'bg-yellow-500', icon: '⭐', label: 'VIP' },
  customer: { bg: 'bg-green-500', icon: '💼', label: 'Customer' },
};

export function SenderAvatar({
  email,
  name,
  size = 'md',
  showStatus = false,
  statusColor,
  className = '',
  relationship,
}: SenderAvatarProps) {
  const initials = useMemo(() => getInitials(name, email), [name, email]);
  const colorClass = useMemo(() => getEmailColor(email), [email]);

  const badge = relationship && relationshipBadgeStyles[relationship];

  return (
    <div className={`relative inline-flex ${className}`}>
      <div
        className={`
          ${sizeClasses[size]}
          ${colorClass}
          rounded-full
          flex items-center justify-center
          text-white font-medium
          select-none
          flex-shrink-0
        `}
        title={name || email}
      >
        {initials}
      </div>
      {/* Relationship badge */}
      {badge && (
        <div
          className={`
            absolute -top-1 -right-1
            w-4 h-4 rounded-full
            ${badge.bg}
            flex items-center justify-center
            text-[10px] border-2 border-white
            shadow-sm
          `}
          title={badge.label}
        >
          {badge.icon}
        </div>
      )}
      {/* Status indicator */}
      {showStatus && statusColor && (
        <div
          className={`
            absolute -bottom-0.5 -right-0.5
            w-3 h-3 rounded-full
            border-2 border-white
            ${statusColor}
          `}
        />
      )}
    </div>
  );
}

// Compact version for participant lists
export function SenderAvatarCompact({
  email,
  name,
  size = 'sm',
}: Omit<SenderAvatarProps, 'showStatus' | 'statusColor' | 'className'>) {
  return <SenderAvatar email={email} name={name} size={size} />;
}
