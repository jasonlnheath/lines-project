/**
 * Pull Queue Manager
 *
 * Manages a queue of emails waiting to be "pulled" by the user.
 * Emails are added when they don't meet push-eligibility criteria.
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Email in the pull queue
 */
export interface QueuedEmail {
  id: string;
  userId: string;
  emailId: string;
  sender: string;
  subject: string;
  receivedAt: number;
  queuedAt: number;
  reason: string; // Why it was queued (not push-eligible)
}

/**
 * Queue query options
 */
export interface QueueQueryOptions {
  userId: string;
  page?: number;
  pageSize?: number;
  startDate?: number;
  endDate?: number;
  sender?: string;
}

/**
 * Queue query result
 */
export interface QueueQueryResult {
  items: QueuedEmail[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Configuration for queue behavior
 */
export interface QueueConfig {
  expirationDays: number;
}

const STORAGE_BASE = 'public/data/pushpull';
const QUEUE_FILE = 'pull_queue.json';
const DEFAULT_EXPIRATION_DAYS = 30;
const DEFAULT_PAGE_SIZE = 20;

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Pull Queue Service
 */
export class PullQueueService {
  private basePath: string;
  private config: QueueConfig;

  constructor(basePath: string = STORAGE_BASE, config?: Partial<QueueConfig>) {
    this.basePath = path.resolve(process.cwd(), basePath);
    this.config = {
      expirationDays: config?.expirationDays ?? DEFAULT_EXPIRATION_DAYS,
    };
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
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(tempPath, content, 'utf-8');
    try {
      await fs.rename(tempPath, filePath);
    } catch (renameError) {
      // On Windows, rename might fail if file doesn't exist
      // Try direct write as fallback
      await fs.writeFile(filePath, content, 'utf-8');
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Get the queue file path for a user
   */
  private getQueueFilePath(userId: string): string {
    return path.join(this.getUserPath(userId), QUEUE_FILE);
  }

  /**
   * Get all queued emails for a user
   */
  private async getQueue(userId: string): Promise<QueuedEmail[]> {
    const filePath = this.getQueueFilePath(userId);
    return this.readJSON<QueuedEmail[]>(filePath, []);
  }

  /**
   * Save the queue for a user
   */
  private async saveQueue(userId: string, queue: QueuedEmail[]): Promise<void> {
    await this.ensureUserDirectory(userId);
    const filePath = this.getQueueFilePath(userId);
    await this.writeJSON(filePath, queue);
  }

  /**
   * Add an email to the pull queue
   * This should only be called for non-push-eligible emails
   */
  async addToQueue(
    userId: string,
    emailId: string,
    sender: string,
    subject: string,
    receivedAt: number,
    reason: string
  ): Promise<QueuedEmail> {
    const queue = await this.getQueue(userId);

    // Check if email is already in queue
    const existing = queue.find((item) => item.emailId === emailId);
    if (existing) {
      return existing;
    }

    const queuedEmail: QueuedEmail = {
      id: generateId(),
      userId,
      emailId,
      sender: sender.toLowerCase(),
      subject,
      receivedAt,
      queuedAt: Date.now(),
      reason,
    };

    queue.push(queuedEmail);
    await this.saveQueue(userId, queue);

    return queuedEmail;
  }

  /**
   * Check if an email is push-eligible based on sender preference
   * Returns true if the email should be pushed (not queued)
   */
  isPushEligible(
    senderPreference: 'push' | 'pull' | null,
    isVIP: boolean,
    hasTimeSensitiveKeyword: boolean,
    isDirectRecipient: boolean,
    isHighImportance: boolean
  ): boolean {
    // If sender is explicitly marked as push, it's push-eligible
    if (senderPreference === 'push') {
      return true;
    }

    // If any push trigger is matched, it's push-eligible
    if (isVIP || hasTimeSensitiveKeyword || isDirectRecipient || isHighImportance) {
      return true;
    }

    // Otherwise, not push-eligible
    return false;
  }

  /**
   * Generate a reason string for why an email was queued
   */
  generateQueueReason(
    senderPreference: 'push' | 'pull' | null,
    isVIP: boolean,
    hasTimeSensitiveKeyword: boolean,
    isDirectRecipient: boolean,
    isHighImportance: boolean
  ): string {
    const reasons: string[] = [];

    if (senderPreference === 'pull') {
      reasons.push('Sender preference is pull');
    } else if (senderPreference === null) {
      reasons.push('No sender preference (default pull)');
    }

    if (!isVIP) {
      reasons.push('Not a VIP sender');
    }

    if (!hasTimeSensitiveKeyword) {
      reasons.push('No time-sensitive keywords');
    }

    if (!isDirectRecipient) {
      reasons.push('Not a direct recipient');
    }

    if (!isHighImportance) {
      reasons.push('Not high importance');
    }

    return reasons.join(', ');
  }

  /**
   * Process an incoming email - add to queue if not push-eligible
   * Returns the queued email if added, null if push-eligible (not queued)
   */
  async processIncomingEmail(
    userId: string,
    emailId: string,
    sender: string,
    subject: string,
    receivedAt: number,
    senderPreference: 'push' | 'pull' | null,
    isVIP: boolean = false,
    hasTimeSensitiveKeyword: boolean = false,
    isDirectRecipient: boolean = false,
    isHighImportance: boolean = false
  ): Promise<QueuedEmail | null> {
    const pushEligible = this.isPushEligible(
      senderPreference,
      isVIP,
      hasTimeSensitiveKeyword,
      isDirectRecipient,
      isHighImportance
    );

    if (pushEligible) {
      return null; // Not added to queue
    }

    const reason = this.generateQueueReason(
      senderPreference,
      isVIP,
      hasTimeSensitiveKeyword,
      isDirectRecipient,
      isHighImportance
    );

    return this.addToQueue(userId, emailId, sender, subject, receivedAt, reason);
  }

  /**
   * Retrieve queued emails with pagination and filtering
   */
  async getQueuedEmails(options: QueueQueryOptions): Promise<QueueQueryResult> {
    let queue = await this.getQueue(options.userId);

    // Apply date range filter
    if (options.startDate !== undefined) {
      queue = queue.filter((item) => item.receivedAt >= options.startDate!);
    }
    if (options.endDate !== undefined) {
      queue = queue.filter((item) => item.receivedAt <= options.endDate!);
    }

    // Apply sender filter
    if (options.sender) {
      const senderLower = options.sender.toLowerCase();
      queue = queue.filter((item) => item.sender.includes(senderLower));
    }

    // Sort by received date (newest first)
    queue.sort((a, b) => b.receivedAt - a.receivedAt);

    const total = queue.length;
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    const items = queue.slice(startIndex, endIndex);
    const hasMore = endIndex < total;

    return {
      items,
      total,
      page,
      pageSize,
      hasMore,
    };
  }

  /**
   * Get a specific queued email by ID
   */
  async getQueuedEmailById(userId: string, queuedEmailId: string): Promise<QueuedEmail | null> {
    const queue = await this.getQueue(userId);
    return queue.find((item) => item.id === queuedEmailId) ?? null;
  }

  /**
   * Get a queued email by the original email ID
   */
  async getQueuedEmailByEmailId(userId: string, emailId: string): Promise<QueuedEmail | null> {
    const queue = await this.getQueue(userId);
    return queue.find((item) => item.emailId === emailId) ?? null;
  }

  /**
   * Remove an email from the queue (e.g., when promoted to push)
   */
  async removeFromQueue(userId: string, queuedEmailId: string): Promise<boolean> {
    const queue = await this.getQueue(userId);
    const initialLength = queue.length;

    const filtered = queue.filter((item) => item.id !== queuedEmailId);

    if (filtered.length === initialLength) {
      return false; // Not found
    }

    await this.saveQueue(userId, filtered);
    return true;
  }

  /**
   * Remove email from queue by original email ID
   */
  async removeByEmailId(userId: string, emailId: string): Promise<boolean> {
    const queue = await this.getQueue(userId);
    const initialLength = queue.length;

    const filtered = queue.filter((item) => item.emailId !== emailId);

    if (filtered.length === initialLength) {
      return false; // Not found
    }

    await this.saveQueue(userId, filtered);
    return true;
  }

  /**
   * Promote an email from queue to push
   * This removes the email from the queue when the user changes sender to "push"
   */
  async promoteToPush(userId: string, senderEmail: string): Promise<number> {
    const queue = await this.getQueue(userId);
    const senderLower = senderEmail.toLowerCase();

    // Find all emails from this sender
    const toRemove = queue.filter((item) => item.sender === senderLower);
    const remaining = queue.filter((item) => item.sender !== senderLower);

    if (toRemove.length > 0) {
      await this.saveQueue(userId, remaining);
    }

    return toRemove.length;
  }

  /**
   * Get the count of queued emails for a user
   */
  async getQueueCount(userId: string): Promise<number> {
    const queue = await this.getQueue(userId);
    return queue.length;
  }

  /**
   * Expire old queue items based on configured threshold
   */
  async expireOldItems(userId: string, expirationDays?: number): Promise<number> {
    const days = expirationDays ?? this.config.expirationDays;
    const expirationThreshold = Date.now() - days * 24 * 60 * 60 * 1000;

    const queue = await this.getQueue(userId);
    const initialLength = queue.length;

    const remaining = queue.filter((item) => item.queuedAt >= expirationThreshold);

    if (remaining.length < initialLength) {
      await this.saveQueue(userId, remaining);
    }

    return initialLength - remaining.length;
  }

  /**
   * Clear all queued emails for a user (for testing)
   */
  async clearQueue(userId: string): Promise<void> {
    await this.saveQueue(userId, []);
  }

  /**
   * Get queue configuration
   */
  getConfig(): QueueConfig {
    return { ...this.config };
  }

  /**
   * Update queue configuration
   */
  setConfig(config: Partial<QueueConfig>): void {
    if (config.expirationDays !== undefined) {
      this.config.expirationDays = config.expirationDays;
    }
  }
}

// Singleton instance
let serviceInstance: PullQueueService | null = null;

/**
 * Get or create the PullQueueService singleton
 */
export function getPullQueueService(): PullQueueService {
  if (!serviceInstance) {
    serviceInstance = new PullQueueService();
  }
  return serviceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetPullQueueService(): void {
  serviceInstance = null;
}
