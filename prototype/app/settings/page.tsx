'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Settings index page - redirects to preferences by default
 */
export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/preferences');
  }, [router]);

  return (
    <div className="p-8 text-center text-gray-500">
      Redirecting to preferences...
    </div>
  );
}
