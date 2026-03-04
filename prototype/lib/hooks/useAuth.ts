'use client';

import { useState, useEffect } from 'react';

export interface UserInfo {
  id: string;
  displayName: string;
  email: string;
}

export interface UserPersona {
  displayName: string;
  role?: string;
  company?: string;
}

export interface AuthState {
  authenticated: boolean;
  user: UserInfo | null;
  persona?: UserPersona | null;
  loading: boolean;
  expired: boolean;
  needsOnboarding: boolean;
}

/**
 * Hook to manage authentication state
 */
export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    authenticated: false,
    user: null,
    persona: null,
    loading: true,
    expired: false,
    needsOnboarding: false,
  });

  useEffect(() => {
    checkAuth();

    // Check if we just came back from auth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('auth') && urlParams.get('auth') === 'success') {
      // Clear URL and refresh auth state
      window.history.replaceState({}, '', '/');
      setTimeout(() => checkAuth(), 100);
    }
  }, []);

  const checkAuth = async () => {
    try {
      // Check auth status
      const authResponse = await fetch('/api/auth/me');
      const authData = await authResponse.json();

      // Check persona status
      const personaResponse = await fetch('/api/persona');
      const personaData = await personaResponse.json();

      setAuth({
        authenticated: authData.authenticated,
        user: authData.user,
        persona: personaData.onboardingCompleted ? {
          displayName: personaData.displayName || '',
          role: personaData.role,
          company: personaData.company,
        } : null,
        loading: false,
        expired: authData.expired || false,
        needsOnboarding: !personaData.onboardingCompleted,
      });
    } catch {
      setAuth({
        authenticated: false,
        user: null,
        persona: null,
        loading: false,
        expired: false,
        needsOnboarding: false,
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
      persona: null,
      loading: false,
      expired: false,
      needsOnboarding: false,
    });
  };

  return { ...auth, login, logout, refreshAuth: checkAuth };
}
