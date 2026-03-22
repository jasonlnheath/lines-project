/**
 * Push Trigger Service
 *
 * Evaluates emails against push rules to determine if they should trigger
 * immediate notification.
 *
 * Now enhanced with relationship context from the contact system.
 */

import { PushPullService } from './pushPullService';
import { VIPSender, TimeSensitiveKeyword } from './types';
import {
  getRelationshipContextProvider,
  PushDecisionWithContext,
} from '../contacts';

/**
 * Result of push trigger evaluation
 */
export interface PushTriggerResult {
  shouldPush: boolean;
  reasons: string[];
  matchedRules: string[];
  priority?: 'high' | 'medium' | 'low';
  contactContext?: unknown; // Contact context if available
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
 * 1. CYA Rules (Cover Your Ass) - manager, executives always push
 * 2. Contact preferences - user-taught push/pull
 * 3. High importance flag
 * 4. Direct recipient (To field)
 * 5. VIP sender
 * 6. Time-sensitive keywords in subject or body
 * 7. Custom trigger rules
 */
export class PushTriggerService {
  private pushPullService: PushPullService;
  private config: PushTriggerConfig | null = null;
  private contextProvider = getRelationshipContextProvider();

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
   * Enhanced with contact relationship context
   */
  async evaluate(userId: string, email: EmailForTrigger): Promise<PushTriggerResult> {
    const reasons: string[] = [];
    const matchedRules: string[] = [];

    // 0. Check contact context first (CYA + user preferences)
    const contactDecision = this.contextProvider.getPushDecision(email.sender, {
      isDirectRecipient: email.toRecipients.some(
        (r) => r.toLowerCase() === userId.toLowerCase()
      ),
      hasUrgentKeywords: this.hasUrgentKeywords(email.subject, email.body),
      isHighImportance: email.importance === 'high',
    });

    // CYA rules (highest priority)
    if (contactDecision.reason === 'your_manager' || contactDecision.reason === 'executive') {
      return {
        shouldPush: true,
        reasons: [contactDecision.reason],
        matchedRules: [`contact:${contactDecision.reason}`],
        priority: contactDecision.priority,
        contactContext: contactDecision.contactContext,
      };
    }

    // User's explicit push preference
    if (contactDecision.reason === 'user_designated_push') {
      return {
        shouldPush: true,
        reasons: ['user-designated push'],
        matchedRules: ['contact:user_designated_push'],
        priority: contactDecision.priority,
        contactContext: contactDecision.contactContext,
      };
    }

    // User's explicit pull preference (skip other checks)
    if (contactDecision.reason === 'user_designated_pull') {
      return {
        shouldPush: false,
        reasons: ['user-designated pull'],
        matchedRules: ['contact:user_designated_pull'],
        priority: 'low',
        contactContext: contactDecision.contactContext,
      };
    }

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

    // 6. Apply contact-based decision if no other rules matched
    if (reasons.length === 0 && contactDecision.reason !== 'default_pull') {
      // Use contact decision as fallback
      return {
        shouldPush: contactDecision.shouldPush,
        reasons: [contactDecision.reason],
        matchedRules: [`contact:${contactDecision.reason}`],
        priority: contactDecision.priority,
        contactContext: contactDecision.contactContext,
      };
    }

    return {
      shouldPush: reasons.length > 0,
      reasons,
      matchedRules,
      priority: contactDecision.priority,
      contactContext: contactDecision.contactContext,
    };
  }

  /**
   * Check for urgent keywords (used for contact decision)
   */
  private hasUrgentKeywords(subject: string, body?: string): boolean {
    const text = `${subject} ${body || ''}`.toLowerCase();
    return DEFAULT_KEYWORDS.some((keyword) => text.includes(keyword));
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
   * Get all custom rules for a user
   */
  async getCustomRules(userId: string): Promise<CustomTriggerRule[]> {
    if (!this.config) {
      return [];
    }
    return this.config.customRules.filter((r) => r.userId === userId);
  }

  /**
   * Remove a custom trigger rule
   */
  async removeCustomRule(userId: string, ruleId: string): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    const index = this.config.customRules.findIndex(
      (r) => r.id === ruleId && r.userId === userId
    );

    if (index < 0) {
      return false;
    }

    this.config.customRules.splice(index, 1);
    return true;
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
