/**
 * Push/Pull Service
 *
 * Business logic for managing push/pull email preferences.
 */

import {
  PushPullPreference,
  VIPSender,
  TimeSensitiveKeyword,
  PreferenceQuery,
  BulkImportResult,
  LegacyPreference,
  MigrationResult,
} from './types';
import { PushPullStorage } from './pushPullStorage';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Convert wildcard pattern to regex for matching
 */
function wildcardToRegex(pattern: string): RegExp {
  // Escape special regex characters except * and ?
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  // Replace * with .* and ? with .
  const regexPattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regexPattern}$`, 'i');
}

/**
 * Push/Pull Service
 */
export class PushPullService {
  private storage: PushPullStorage;

  constructor(storage?: PushPullStorage) {
    this.storage = storage ?? new PushPullStorage();
  }

  /**
   * Set a push/pull preference for a sender or subject
   */
  async setPreference(
    userId: string,
    type: 'sender' | 'subject',
    value: string,
    mode: 'push' | 'pull'
  ): Promise<PushPullPreference> {
    const preferences = await this.storage.getPreferences(userId);

    // Check if preference already exists for this value
    const existingIndex = preferences.findIndex(
      (p) => p.userId === userId && p.type === type && p.value.toLowerCase() === value.toLowerCase()
    );

    const now = Date.now();

    if (existingIndex >= 0) {
      // Update existing preference
      preferences[existingIndex].mode = mode;
      preferences[existingIndex].updatedAt = now;
      await this.storage.savePreferences(userId, preferences);
      return preferences[existingIndex];
    }

    // Create new preference
    const newPreference: PushPullPreference = {
      id: generateId(),
      userId,
      type,
      value,
      mode,
      createdAt: now,
      updatedAt: now,
    };

    preferences.push(newPreference);
    await this.storage.savePreferences(userId, preferences);
    return newPreference;
  }

  /**
   * Get preference for a specific sender or subject
   * Returns null if no preference exists (default behavior is 'pull')
   */
  async getPreference(
    userId: string,
    type: 'sender' | 'subject',
    value: string
  ): Promise<'push' | 'pull' | null> {
    const preferences = await this.storage.getPreferences(userId);

    // Exact match first
    const exactMatch = preferences.find(
      (p) => p.userId === userId && p.type === type && p.value.toLowerCase() === value.toLowerCase()
    );

    if (exactMatch) {
      return exactMatch.mode;
    }

    // For subjects, check wildcard patterns
    if (type === 'subject') {
      const wildcardMatch = preferences.find((p) => {
        if (p.userId !== userId || p.type !== 'subject') {
          return false;
        }
        // Check if the preference value contains wildcards
        if (p.value.includes('*') || p.value.includes('?')) {
          const regex = wildcardToRegex(p.value);
          return regex.test(value);
        }
        return false;
      });

      if (wildcardMatch) {
        return wildcardMatch.mode;
      }
    }

    return null; // No preference found (default is 'pull')
  }

  /**
   * Query preferences by type and optional value pattern
   */
  async queryPreferences(query: PreferenceQuery): Promise<PushPullPreference[]> {
    const preferences = await this.storage.getPreferences(query.userId);

    return preferences.filter((p) => {
      if (query.type && p.type !== query.type) {
        return false;
      }
      if (query.value) {
        // Case-insensitive partial match
        return p.value.toLowerCase().includes(query.value.toLowerCase());
      }
      return true;
    });
  }

  /**
   * Delete a preference
   */
  async deletePreference(userId: string, preferenceId: string): Promise<boolean> {
    const preferences = await this.storage.getPreferences(userId);
    const initialLength = preferences.length;

    const filtered = preferences.filter((p) => p.id !== preferenceId);

    if (filtered.length === initialLength) {
      return false; // Not found
    }

    await this.storage.savePreferences(userId, filtered);
    return true;
  }

  /**
   * Bulk import preferences
   */
  async bulkImport(
    userId: string,
    items: Array<{ type: 'sender' | 'subject'; value: string; mode: 'push' | 'pull' }>
  ): Promise<BulkImportResult> {
    const startTime = Date.now();
    let imported = 0;
    let updated = 0;
    let failed = 0;

    const preferences = await this.storage.getPreferences(userId);
    const now = Date.now();

    for (const item of items) {
      try {
        const existingIndex = preferences.findIndex(
          (p) =>
            p.userId === userId &&
            p.type === item.type &&
            p.value.toLowerCase() === item.value.toLowerCase()
        );

        if (existingIndex >= 0) {
          // Update existing
          preferences[existingIndex].mode = item.mode;
          preferences[existingIndex].updatedAt = now;
          updated++;
        } else {
          // Add new
          preferences.push({
            id: generateId(),
            userId,
            type: item.type,
            value: item.value,
            mode: item.mode,
            createdAt: now,
            updatedAt: now,
          });
          imported++;
        }
      } catch (error) {
        failed++;
      }
    }

    await this.storage.savePreferences(userId, preferences);

    const durationMs = Date.now() - startTime;

    return { imported, updated, failed, durationMs };
  }

  /**
   * Migrate legacy preferences from Phase 1
   */
  async migrateLegacy(userId: string, legacy: LegacyPreference[]): Promise<MigrationResult> {
    const migrated: string[] = [];
    const errors: string[] = [];

    for (const item of legacy) {
      try {
        if (item.sender) {
          await this.setPreference(userId, 'sender', item.sender, item.mode);
          migrated.push(item.sender);
        } else if (item.subject) {
          await this.setPreference(userId, 'subject', item.subject, item.mode);
          migrated.push(item.subject);
        }
      } catch (error) {
        errors.push(`${item.sender || item.subject}: ${error}`);
      }
    }

    return {
      migrated: migrated.length,
      skipped: legacy.length - migrated.length,
      errors,
    };
  }

  /**
   * Get default mode for new senders/subjects
   */
  getDefaultMode(): 'pull' {
    return 'pull';
  }

  // VIP Senders

  /**
   * Add VIP sender
   */
  async addVIPSender(userId: string, email: string, domain?: string): Promise<VIPSender> {
    const vipSenders = await this.storage.getVIPSenders(userId);

    // Check for duplicates
    const existing = vipSenders.find(
      (v) => v.userId === userId && v.email.toLowerCase() === email.toLowerCase()
    );

    if (existing) {
      return existing;
    }

    const newVIP: VIPSender = {
      id: generateId(),
      userId,
      email: email.toLowerCase(),
      domain: domain?.toLowerCase(),
      createdAt: Date.now(),
    };

    vipSenders.push(newVIP);
    await this.storage.saveVIPSenders(userId, vipSenders);
    return newVIP;
  }

  /**
   * Check if sender is VIP
   */
  async isVIPSender(userId: string, senderEmail: string): Promise<boolean> {
    const vipSenders = await this.storage.getVIPSenders(userId);
    const email = senderEmail.toLowerCase();

    return vipSenders.some((v) => {
      if (v.userId !== userId) {
        return false;
      }
      // Exact match
      if (v.email === email) {
        return true;
      }
      // Domain wildcard match
      if (v.domain && email.endsWith(v.domain)) {
        return true;
      }
      return false;
    });
  }

  // Time-Sensitive Keywords

  /**
   * Add time-sensitive keyword
   */
  async addKeyword(
    userId: string,
    keyword: string,
    caseInsensitive: boolean = true
  ): Promise<TimeSensitiveKeyword> {
    const keywords = await this.storage.getKeywords(userId);

    // Check for duplicates
    const existing = keywords.find(
      (k) => k.userId === userId && k.keyword.toLowerCase() === keyword.toLowerCase()
    );

    if (existing) {
      return existing;
    }

    const newKeyword: TimeSensitiveKeyword = {
      id: generateId(),
      userId,
      keyword,
      caseInsensitive,
      createdAt: Date.now(),
    };

    keywords.push(newKeyword);
    await this.storage.saveKeywords(userId, keywords);
    return newKeyword;
  }

  /**
   * Check if text contains time-sensitive keywords
   */
  async containsKeyword(userId: string, text: string): Promise<boolean> {
    const keywords = await this.storage.getKeywords(userId);

    return keywords.some((k) => {
      if (k.userId !== userId) {
        return false;
      }

      if (k.caseInsensitive) {
        return text.toLowerCase().includes(k.keyword.toLowerCase());
      }

      return text.includes(k.keyword);
    });
  }
}

// Singleton instance
let serviceInstance: PushPullService | null = null;

/**
 * Get or create the PushPullService singleton
 */
export function getPushPullService(): PushPullService {
  if (!serviceInstance) {
    serviceInstance = new PushPullService();
  }
  return serviceInstance;
}
