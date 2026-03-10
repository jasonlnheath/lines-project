/**
 * Push/Pull Storage
 *
 * Filesystem-based storage for push/pull preferences.
 * MVP implementation using JSON files.
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  PushPullPreference,
  VIPSender,
  TimeSensitiveKeyword,
} from './types';

const STORAGE_BASE = 'public/data/pushpull';
const FILES = {
  PREFERENCES: 'preferences.json',
  VIP_SENDERS: 'vip_senders.json',
  KEYWORDS: 'keywords.json',
} as const;

interface StorageData {
  preferences: PushPullPreference[];
  vipSenders: VIPSender[];
  keywords: TimeSensitiveKeyword[];
}

/**
 * Filesystem-based Push/Pull Storage
 */
export class PushPullStorage {
  private basePath: string;

  constructor(basePath: string = STORAGE_BASE) {
    this.basePath = path.resolve(process.cwd(), basePath);
  }

  /**
   * Get user's storage directory
   */
  private getUserPath(userId: string): string {
    return path.join(this.basePath, userId);
  }

  /**
   * Ensure user directory exists
   */
  private async ensureUserDirectory(userId: string): Promise<void> {
    const userPath = this.getUserPath(userId);
    await fs.mkdir(userPath, { recursive: true });
  }

  /**
   * Read JSON file safely
   */
  private async readJSON<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * Write JSON file atomically
   */
  private async writeJSON<T>(filePath: string, data: T): Promise<void> {
    const tempPath = filePath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  }

  /**
   * Get all preferences for a user
   */
  async getPreferences(userId: string): Promise<PushPullPreference[]> {
    const userPath = this.getUserPath(userId);
    const filePath = path.join(userPath, FILES.PREFERENCES);
    return this.readJSON<PushPullPreference[]>(filePath, []);
  }

  /**
   * Save preferences for a user
   */
  async savePreferences(userId: string, preferences: PushPullPreference[]): Promise<void> {
    await this.ensureUserDirectory(userId);
    const userPath = this.getUserPath(userId);
    const filePath = path.join(userPath, FILES.PREFERENCES);
    await this.writeJSON(filePath, preferences);
  }

  /**
   * Get VIP senders for a user
   */
  async getVIPSenders(userId: string): Promise<VIPSender[]> {
    const userPath = this.getUserPath(userId);
    const filePath = path.join(userPath, FILES.VIP_SENDERS);
    return this.readJSON<VIPSender[]>(filePath, []);
  }

  /**
   * Save VIP senders for a user
   */
  async saveVIPSenders(userId: string, vipSenders: VIPSender[]): Promise<void> {
    await this.ensureUserDirectory(userId);
    const userPath = this.getUserPath(userId);
    const filePath = path.join(userPath, FILES.VIP_SENDERS);
    await this.writeJSON(filePath, vipSenders);
  }

  /**
   * Get time-sensitive keywords for a user
   */
  async getKeywords(userId: string): Promise<TimeSensitiveKeyword[]> {
    const userPath = this.getUserPath(userId);
    const filePath = path.join(userPath, FILES.KEYWORDS);
    return this.readJSON<TimeSensitiveKeyword[]>(filePath, []);
  }

  /**
   * Save time-sensitive keywords for a user
   */
  async saveKeywords(userId: string, keywords: TimeSensitiveKeyword[]): Promise<void> {
    await this.ensureUserDirectory(userId);
    const userPath = this.getUserPath(userId);
    const filePath = path.join(userPath, FILES.KEYWORDS);
    await this.writeJSON(filePath, keywords);
  }

  /**
   * Clear all data for a user (for testing)
   */
  async clearUserData(userId: string): Promise<void> {
    const userPath = this.getUserPath(userId);
    try {
      await fs.rm(userPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  }
}
