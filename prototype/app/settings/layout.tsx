'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SettingsLayoutProps {
  children: ReactNode;
}

const tabs = [
  { name: 'Preferences', href: '/settings/preferences', icon: '⚙️' },
  { name: 'Priority Rules', href: '/settings/rules', icon: '🎯' },
  { name: 'Trigger Rules', href: '/settings/triggers', icon: '⚡' },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 text-sm mt-1">
            Configure your email push/pull preferences and rules
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex gap-6">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`
                    flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm
                    transition-colors
                    ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
}
