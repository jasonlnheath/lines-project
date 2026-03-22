/**
 * Push/Pull Data Types
 *
 * Types for the push/pull email preference system.
 * Preferences can be set for:
 * - sender: specific email addresses or domain wildcards
 * - thread: specific conversation threads (by conversationId) - only if NOT in a Line
 * - line: topic lines/clusters (by lineId) - takes priority over thread preferences
 */

/**
 * Push/Pull preference type
 */
export type PreferenceType = 'sender' | 'thread' | 'line';

/**
 * Sender preference (combines old VIPSender + PushPullPreference for senders)
 * Supports individual emails AND domain wildcards (e.g., *@company.com)
 * Supports phone numbers for text/voicemail senders
 */
export interface SenderPreference {
  id: string;
  userId: string;
  value: string;           // email address, phone number, or *@domain.com
  name?: string;           // display name (e.g., "John Smith")
  isDomain: boolean;       // true if value is a domain wildcard
  isBoss: boolean;         // Boss flag (highest priority, always push)
  isVIP: boolean;          // VIP flag for special treatment + always push
  mode: 'push' | 'pull';
  createdAt: number;
  updatedAt: number;
}

/**
 * Push/Pull preference for a sender, thread or line
 * Note: Thread preferences only apply if the thread is NOT in a Line
 */
export interface PushPullPreference {
  id: string;
  userId: string;
  type: PreferenceType;
  value: string; // email, phone, conversationId or lineId
  name?: string; // display name for senders
  isBoss?: boolean; // Boss flag (highest priority) - for sender type
  isVIP?: boolean; // VIP flag - for sender type
  mode: 'push' | 'pull';
  createdAt: number;
  updatedAt: number;
}

/**
 * @deprecated Use SenderPreference instead
 * VIP sender definition - kept for migration compatibility
 */
export interface VIPSender {
  id: string;
  userId: string;
  email: string;
  domain?: string;
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
  type?: PreferenceType;
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
