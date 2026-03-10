/**
 * Push Trigger Service
 *
 * Evaluates emails against push rules to determine if they should trigger
 * immediate notification.
 */

import { PushPullService } from './pushPullService';
import { VIPSender, TimeSensitiveKeyword } from './types';

/**
 * Result of push trigger evaluation
 */
export interface PushTriggerResult {
  shouldPush: boolean;
  reasons: string[];
  matchedRules: string[];
}

/**
 * Email input for trigger evaluation
 */
export interface EmailForTrigger {
  id: string;
  sender: string;
  subject: string;
  body?: string;
  importance?: 'high' | 'normal' | 'low';
  toRecipients: string[];
  ccRecipients: string[];
}

/**
 * Custom trigger rule
 */
export interface CustomTriggerRule {
  id: string;
  userId: string;
  name: string;
  type: 'subject' | 'body' | 'sender';
  pattern: string;
  caseInsensitive: boolean;
  createdAt: number;
}

/**
 * Configuration for the push trigger service
 */
export interface PushTriggerConfig {
  vipSenders: VIPSender[];
  keywords: TimeSensitiveKeyword[];
  customRules: CustomTriggerRule[];
}

/**
 * Default time-sensitive keywords
 */
const DEFAULT_KEYWORDS = [
  'urgent',
  'asap',
  'deadline',
  'today',
  'tomorrow',
  'important',
  'critical',
];

/**
 * Push Trigger Service
 *
 * Evaluates emails against multiple push trigger conditions:
 * 1. High importance flag
 * 2. Direct recipient (To field)
 * 3. VIP sender
 * 4. Time-sensitive keywords in subject or body
 * 5. Custom trigger rules
 */
export class PushTriggerService {
  private pushPullService: PushPullService;
  private config: PushTriggerConfig | null = null;

  constructor(pushPullService?: PushPullService) {
    this.pushPullService = pushPullService ?? new PushPullService();
  }

  /**
   * Set configuration for trigger evaluation
   */
  setConfig(config: PushTriggerConfig): void {
    this.config = config;
  }

  /**
   * Evaluate an email for push triggers
   */
  async evaluate(userId: string, email: EmailForTrigger): Promise<PushTriggerResult> {
    const reasons: string[] = [];
    const matchedRules: string[] = [];

    // 1. Check high importance flag
    if (email.importance === 'high') {
      reasons.push('high importance flag');
      matchedRules.push('importance:high');
    }

    // 2. Check if user is direct recipient (To field)
    const userEmail = userId; // Assuming userId is the email for now
    const isDirectRecipient = email.toRecipients.some(
      (r) => r.toLowerCase() === userEmail.toLowerCase()
    );

    if (isDirectRecipient) {
      reasons.push('direct recipient');
      matchedRules.push('recipient:to');
    }

    // 3. Check VIP sender
    const vipMatch = await this.checkVIPSender(userId, email.sender);
    if (vipMatch) {
      reasons.push('VIP sender');
      matchedRules.push(vipMatch);
    }

    // 4. Check time-sensitive keywords
    const keywordMatches = await this.checkKeywords(userId, email.subject, email.body);
    if (keywordMatches.length > 0) {
      reasons.push('time-sensitive keyword');
      matchedRules.push(...keywordMatches);
    }

    // 5. Check custom rules
    const customMatches = await this.checkCustomRules(userId, email);
    if (customMatches.length > 0) {
      matchedRules.push(...customMatches);
      // Add custom rule reasons
      for (const match of customMatches) {
        if (!reasons.includes('custom rule')) {
          reasons.push('custom rule');
        }
      }
    }

    return {
      shouldPush: reasons.length > 0,
      reasons,
      matchedRules,
    };
  }

  /**
   * Check if sender is a VIP
   */
  private async checkVIPSender(userId: string, sender: string): Promise<string | null> {
    const senderLower = sender.toLowerCase();

    // Check config first (for tests with mock data)
    if (this.config) {
      for (const vip of this.config.vipSenders) {
        if (vip.userId !== userId) continue;

        // Exact email match
        if (vip.email.toLowerCase() === senderLower) {
          return `vip:exact:${vip.email}`;
        }

        // Domain wildcard match
        if (vip.domain && senderLower.endsWith(vip.domain.toLowerCase())) {
          return `vip:domain:${vip.domain}`;
        }
      }
    }

    // Fall back to pushPullService
    const isVIP = await this.pushPullService.isVIPSender(userId, sender);
    if (isVIP) {
      return `vip:${sender}`;
    }

    return null;
  }

  /**
   * Check for time-sensitive keywords
   */
  private async checkKeywords(
    userId: string,
    subject: string,
    body?: string
  ): Promise<string[]> {
    const matches: string[] = [];
    const textToCheck = `${subject} ${body || ''}`.toLowerCase();

    // Check config keywords first
    let keywords = DEFAULT_KEYWORDS;

    if (this.config && this.config.keywords.length > 0) {
      keywords = this.config.keywords
        .filter((k) => k.userId === userId)
        .map((k) => k.keyword.toLowerCase());
    }

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      if (textToCheck.includes(keywordLower)) {
        matches.push(`keyword:${keyword}`);
      }
    }

    return matches;
  }

  /**
   * Check custom trigger rules
   */
  private async checkCustomRules(
    userId: string,
    email: EmailForTrigger
  ): Promise<string[]> {
    const matches: string[] = [];

    if (!this.config) {
      return matches;
    }

    for (const rule of this.config.customRules) {
      if (rule.userId !== userId) continue;

      let textToCheck = '';
      switch (rule.type) {
        case 'subject':
          textToCheck = email.subject;
          break;
        case 'body':
          textToCheck = email.body || '';
          break;
        case 'sender':
          textToCheck = email.sender;
          break;
      }

      const pattern = rule.caseInsensitive
        ? new RegExp(rule.pattern, 'i')
        : new RegExp(rule.pattern);

      if (pattern.test(textToCheck)) {
        matches.push(`custom:${rule.id}:${rule.name}`);
      }
    }

    return matches;
  }

  /**
   * Add a custom trigger rule
   */
  async addCustomRule(
    userId: string,
    name: string,
    type: 'subject' | 'body' | 'sender',
    pattern: string,
    caseInsensitive: boolean = true
  ): Promise<CustomTriggerRule> {
    const rule: CustomTriggerRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      userId,
      name,
      type,
      pattern,
      caseInsensitive,
      createdAt: Date.now(),
    };

    if (this.config) {
      this.config.customRules.push(rule);
    }

    return rule;
  }

  /**
   * Evaluate performance - run evaluation and return timing
   */
  async evaluateWithTiming(
    userId: string,
    email: EmailForTrigger
  ): Promise<{ result: PushTriggerResult; durationMs: number }> {
    const startTime = performance.now();
    const result = await this.evaluate(userId, email);
    const durationMs = performance.now() - startTime;

    return { result, durationMs };
  }
}

// Singleton instance
let serviceInstance: PushTriggerService | null = null;

/**
 * Get or create the PushTriggerService singleton
 */
export function getPushTriggerService(): PushTriggerService {
  if (!serviceInstance) {
    serviceInstance = new PushTriggerService();
  }
  return serviceInstance;
}

/**
 * Create a new PushTriggerService instance with config
 */
export function createPushTriggerServiceWithConfig(
  config: PushTriggerConfig,
  pushPullService?: PushPullService
): PushTriggerService {
  const service = new PushTriggerService(pushPullService);
  service.setConfig(config);
  return service;
}
