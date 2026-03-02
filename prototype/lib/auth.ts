/**
 * Token storage utilities
 * In production, use secure storage (Redis, database, encrypted cookies)
 */

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];
  userId: string;
}

const TOKEN_STORAGE_KEY = 'msal_tokens';

export const tokenStorage = {
  /**
   * Store tokens in memory (for prototype)
   * In production, use secure database or encrypted session storage
   */
  set: (data: TokenData): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(data));
    }
  },

  get: (): TokenData | null => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  clear: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  },

  isExpired: (tokens: TokenData): boolean => {
    // Add 5 minute buffer before actual expiration
    return Date.now() >= tokens.expiresAt - 300000;
  },
};

/**
 * Generate random state for CSRF protection
 */
export function generateState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Generate code verifier for PKCE
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate code challenge from verifier for PKCE
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(buffer: Uint8Array): string {
  let str = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Validate state parameter to prevent CSRF attacks
 */
export function validateState(receivedState: string, expectedState: string): boolean {
  return receivedState === expectedState;
}
