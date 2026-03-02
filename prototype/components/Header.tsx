'use client';

import { useAuth } from '@/lib/hooks/useAuth';

export function Header() {
  const { authenticated, user, loading, login, logout } = useAuth();

  return (
    <header className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-3xl font-bold">Lines Prototype</h1>
        <p className="text-gray-600 text-sm">Agent-Based Email Search</p>
      </div>

      <div className="flex items-center gap-4">
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : authenticated ? (
          <>
            <div className="text-sm">
              <span className="font-medium">{user?.displayName}</span>
              <span className="text-gray-500 ml-2">({user?.email})</span>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
            >
              Logout
            </button>
          </>
        ) : (
          <button
            onClick={login}
            className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
          >
            Login with Microsoft
          </button>
        )}
      </div>
    </header>
  );
}
