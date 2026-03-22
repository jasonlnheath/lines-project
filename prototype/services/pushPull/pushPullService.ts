/**
 * Push/Pull Service
 *
 * Business logic for managing push/pull email preferences.
 * Supports three preference types:
 * - sender: specific email addresses
 * - thread: specific conversation threads (by conversationId)
 * - line: topic lines/clusters (by lineId)
 */

import {
  PushPullPreference,
  VIPSender,
  TimeSensitiveKeyword,
  PreferenceQuery,
  PreferenceType,
} from './types';
import { PushPullStorage } from './pushPullStorage';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
   * Set a push/pull preference for a sender, thread, or line
   */
  async setPreference(
    userId: string,
    type: PreferenceType,
    value: string,
    mode: 'push' | 'pull',
    extra?: { isBoss?: boolean; isVIP?: boolean; name?: string }
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
      if (extra?.isBoss !== undefined) preferences[existingIndex].isBoss = extra.isBoss;
      if (extra?.isVIP !== undefined) preferences[existingIndex].isVIP = extra.isVIP;
      if (extra?.name !== undefined) preferences[existingIndex].name = extra.name;
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
      isBoss: extra?.isBoss || false,
      isVIP: extra?.isVIP || false,
      name: extra?.name,
      createdAt: now,
      updatedAt: now,
    };

    preferences.push(newPreference);
    await this.storage.savePreferences(userId, preferences);
    return newPreference;
  }

  /**
   * Get preference for a specific sender, thread, or line
   * Returns null if no preference exists (default behavior is 'pull')
   */
  async getPreference(
    userId: string,
    type: PreferenceType,
    value: string
  ): Promise<'push' | 'pull' | null> {
    const preferences = await this.storage.getPreferences(userId);

    // Exact match only - no wildcard matching for security
    const match = preferences.find(
      (p) => p.userId === userId && p.type === type && p.value.toLowerCase() === value.toLowerCase()
    );

    return match?.mode ?? null; // No preference found (default is 'pull')
  }

  /**
   * Get preference for an email considering all types
   * Checks sender, thread (conversationId), and line preferences
   */
  async getPreferenceForEmail(
    userId: string,
    email: { sender: string; conversationId: string; lineId?: string }
  ): Promise<{ mode: 'push' | 'pull'; matchedType: PreferenceType | 'default' }> {
    // 1. Check sender preference
    const senderPref = await this.getPreference(userId, 'sender', email.sender);
    if (senderPref) {
      return { mode: senderPref, matchedType: 'sender' };
    }

    // 2. Check thread preference
    const threadPref = await this.getPreference(userId, 'thread', email.conversationId);
    if (threadPref) {
      return { mode: threadPref, matchedType: 'thread' };
    }

    // 3. Check line preference (if email belongs to a line)
    if (email.lineId) {
      const linePref = await this.getPreference(userId, 'line', email.lineId);
      if (linePref) {
        return { mode: linePref, matchedType: 'line' };
      }
    }

    // Default to pull
    return { mode: 'pull', matchedType: 'default' };
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
   * Get a single preference by ID
   */
  async getPreferenceById(userId: string, preferenceId: string): Promise<PushPullPreference | null> {
    const preferences = await this.storage.getPreferences(userId);
    return preferences.find((p) => p.id === preferenceId && p.userId === userId) || null;
  }

  /**
   * Update a preference by ID
   */
  async updatePreferenceById(
    userId: string,
    preferenceId: string,
    updates: Partial<Pick<PushPullPreference, 'mode' | 'isVIP' | 'isBoss' | 'name'>>
  ): Promise<PushPullPreference | null> {
    const preferences = await this.storage.getPreferences(userId);
    const index = preferences.findIndex((p) => p.id === preferenceId && p.userId === userId);

    if (index < 0) {
      return null; // Not found
    }

    // Apply updates
    preferences[index] = {
      ...preferences[index],
      ...updates,
      updatedAt: Date.now(),
    };

    await this.storage.savePreferences(userId, preferences);
    return preferences[index];
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
    items: Array<{ type: PreferenceType; value: string; mode: 'push' | 'pull' }>
  ): Promise<{ imported: number; updated: number; failed: number; durationMs: number }> {
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
   * Get default mode for new senders/threads/lines
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

  /**
   * Get all VIP senders for a user
   */
  async getVIPSenders(userId: string): Promise<VIPSender[]> {
    const vipSenders = await this.storage.getVIPSenders(userId);
    return vipSenders.filter((v) => v.userId === userId);
  }

  /**
   * Remove a VIP sender
   */
  async removeVIPSender(userId: string, vipId: string): Promise<boolean> {
    const vipSenders = await this.storage.getVIPSenders(userId);
    const index = vipSenders.findIndex((v) => v.id === vipId && v.userId === userId);

    if (index < 0) {
      return false;
    }

    vipSenders.splice(index, 1);
    await this.storage.saveVIPSenders(userId, vipSenders);
    return true;
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

  /**
   * Get all keywords for a user
   */
  async getKeywords(userId: string): Promise<TimeSensitiveKeyword[]> {
    const keywords = await this.storage.getKeywords(userId);
    return keywords.filter((k) => k.userId === userId);
  }

  /**
   * Delete a keyword
   */
  async deleteKeyword(userId: string, keywordId: string): Promise<boolean> {
    const keywords = await this.storage.getKeywords(userId);
    const index = keywords.findIndex((k) => k.id === keywordId && k.userId === userId);

    if (index < 0) {
      return false;
    }

    keywords.splice(index, 1);
    await this.storage.saveKeywords(userId, keywords);
    return true;
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
