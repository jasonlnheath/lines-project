'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (url: string, options?: RequestInit) => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook for standardized API calls with loading/error states
 * Automatically aborts pending requests on unmount
 */
export function useApi<T = unknown>(): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const execute = useCallback(async (url: string, options: RequestInit = {}): Promise<T | null> => {
    // Abort any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(url, {
        ...options,
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }

      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}

/**
 * Hook for GET requests with automatic fetching
 */
export function useFetch<T = unknown>(url: string | null) {
  const { data, loading, error, execute, reset } = useApi<T>();

  const refetch = useCallback(() => {
    if (url) {
      return execute(url, { method: 'GET' });
    }
    return Promise.resolve(null);
  }, [url, execute]);

  useEffect(() => {
    if (url) {
      execute(url, { method: 'GET' });
    }
  }, [url, execute]);

  return { data, loading, error, refetch, reset };
}

/**
 * Hook for mutations (POST, PUT, DELETE, PATCH)
 */
export function useMutation<T = unknown, TBody = unknown>() {
  const { data, loading, error, execute, reset } = useApi<T>();

  const mutate = useCallback(
    async (url: string, body?: TBody, method: 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'POST') => {
      return execute(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    [execute]
  );

  return { data, loading, error, mutate, reset };
}
