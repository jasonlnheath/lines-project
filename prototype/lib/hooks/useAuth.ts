'use client';

import { useState, useEffect } from 'react';

export interface UserInfo {
  id: string;
  displayName: string;
  email: string;
}

export interface AuthState {
  authenticated: boolean;
  user: UserInfo | null;
  loading: boolean;
  expired: boolean;
}

/**
 * Hook to manage authentication state
 */
export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    authenticated: false,
    user: null,
    loading: true,
    expired: false,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setAuth({
        authenticated: data.authenticated,
        user: data.user,
        loading: false,
        expired: data.expired || false,
      });
    } catch {
      setAuth({
        authenticated: false,
        user: null,
        loading: false,
        expired: false,
      });
    }
  };

  const login = () => {
    window.location.href = '/api/auth/login';
  };

  const logout = async () => {
    await fetch('/api/auth/logout');
    setAuth({
      authenticated: false,
      user: null,
      loading: false,
      expired: false,
    });
  };

  return { ...auth, login, logout, refreshAuth: checkAuth };
}
