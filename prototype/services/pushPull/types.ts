/**
 * Push/Pull Data Types
 *
 * Types for the push/pull email preference system.
 */

/**
 * Push/Pull preference for a sender or subject
 */
export interface PushPullPreference {
  id: string;
  userId: string;
  type: 'sender' | 'subject';
  value: string; // email address or subject pattern
  mode: 'push' | 'pull';
  createdAt: number;
  updatedAt: number;
}

/**
 * VIP sender definition
 */
export interface VIPSender {
  id: string;
  userId: string;
  email: string; // Exact email address
  domain?: string; // Optional domain wildcard (e.g., "@company.com")
  createdAt: number;
}

/**
 * Time-sensitive keyword definition
 */
export interface TimeSensitiveKeyword {
  id: string;
  userId: string;
  keyword: string;
  caseInsensitive?: boolean;
  createdAt: number;
}

/**
 * Query options for preferences
 */
export interface PreferenceQuery {
  userId: string;
  type?: 'sender' | 'subject';
  value?: string;
}

/**
 * Bulk import result
 */
export interface BulkImportResult {
  imported: number;
  updated: number;
  failed: number;
  durationMs: number;
}

/**
 * Legacy preference format (Phase 1)
 */
export interface LegacyPreference {
  sender?: string;
  subject?: string;
  mode: 'push' | 'pull';
}

/**
 * Migration result
 */
export interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: string[];
}
