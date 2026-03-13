/**
 * Relationship Context Provider
 *
 * Provides contact relationship context for push/pull decisions.
 * This is the main interface for the push trigger service to lookup contacts.
 */

import { Contact, ContactPushPreference, NewSenderPrompt } from './types';
import { ContactSyncService } from './contactSyncService';

/**
 * Contact context summary
 * Simplified view of a contact for push/pull decision making
 */
export interface ContactContext {
  exists: boolean;
  isMyManager: boolean;
  isMyDirectReport: boolean;
  isExecutive: boolean;
  isInternal: boolean;
  relevanceScore: number;
  isFavorite: boolean;
  pushPreference: ContactPushPreference;
  displayName?: string;
  companyName?: string;
  jobTitle?: string;
  suggestedAction: 'push' | 'pull' | 'ask';
  reason: string;
}

/**
 * Push decision with contact context
 */
export interface PushDecisionWithContext {
  shouldPush: boolean;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  contactContext?: ContactContext;
}

/**
 * Relationship Context Provider
 *
 * Looks up contacts and provides context for push/pull decisions.
 * Auto-detects important relationships (manager, executives).
 */
export class RelationshipContextProvider {
  private contactSyncService: ContactSyncService;
  private userDomain?: string;
  private managerEmail?: string;
  private executiveDomains: Set<string> = new Set();

  constructor(contactSyncService?: ContactSyncService) {
    this.contactSyncService = contactSyncService ?? new ContactSyncService();
  }

  /**
   * Initialize with user context
   */
  initialize(config: { userDomain?: string; managerEmail?: string }): void {
    this.userDomain = config.userDomain;
    this.managerEmail = config.managerEmail?.toLowerCase();
  }

  /**
   * Get contact context for an email address
   */
  getContactContext(email: string): ContactContext {
    const contact = this.contactSyncService.getContactByEmail(email);
    const normalizedEmail = email.toLowerCase();

    // Check if this is the manager (even without contact in index)
    const isManagerEmail = this.managerEmail && normalizedEmail === this.managerEmail.toLowerCase();

    if (!contact) {
      // Unknown contact - but check if it's the manager
      if (isManagerEmail) {
        return {
          exists: false,
          isMyManager: true,
          isMyDirectReport: false,
          isExecutive: false,
          isInternal: this.isSameDomain(email),
          relevanceScore: 10,
          isFavorite: false,
          pushPreference: 'unset',
          suggestedAction: 'push',
          reason: 'your_manager',
        };
      }

      // Unknown contact - suggest pull by default
      return {
        exists: false,
        isMyManager: false,
        isMyDirectReport: false,
        isExecutive: false,
        isInternal: this.isSameDomain(email),
        relevanceScore: 0,
        isFavorite: false,
        pushPreference: 'unset',
        suggestedAction: 'pull',
        reason: 'unknown_sender',
      };
    }

    // Known contact - compute suggested action
    const suggestedAction = this.computeSuggestedAction(contact);
    const reason = this.getReason(contact, suggestedAction);

    return {
      exists: true,
      isMyManager: contact.isMyManager,
      isMyDirectReport: contact.isMyDirectReport,
      isExecutive: contact.isExecutive,
      isInternal: contact.isInternal,
      relevanceScore: contact.relevanceScore,
      isFavorite: contact.isFavorite,
      pushPreference: contact.pushPreference,
      displayName: contact.displayName,
      companyName: contact.companyName,
      jobTitle: contact.jobTitle,
      suggestedAction,
      reason,
    };
  }

  /**
   * Get push decision with full contact context
   */
  getPushDecision(
    email: string,
    additionalContext?: {
      isDirectRecipient?: boolean;
      hasUrgentKeywords?: boolean;
      isHighImportance?: boolean;
    }
  ): PushDecisionWithContext {
    const contactContext = this.getContactContext(email);

    // CYA Rules (Cover Your Ass) - Highest priority
    if (contactContext.isMyManager) {
      return {
        shouldPush: true,
        priority: 'high',
        reason: 'your_manager',
        contactContext,
      };
    }

    if (contactContext.isExecutive) {
      return {
        shouldPush: true,
        priority: 'high',
        reason: 'executive',
        contactContext,
      };
    }

    // User's explicit preference (if set)
    if (contactContext.pushPreference === 'push') {
      return {
        shouldPush: true,
        priority: 'medium',
        reason: 'user_designated_push',
        contactContext,
      };
    }

    if (contactContext.pushPreference === 'pull') {
      return {
        shouldPush: false,
        priority: 'low',
        reason: 'user_designated_pull',
        contactContext,
      };
    }

    // People API signals - frequent communicators
    if (contactContext.relevanceScore >= 7) {
      return {
        shouldPush: true,
        priority: 'medium',
        reason: 'frequent_contact',
        contactContext,
      };
    }

    // Favorites
    if (contactContext.isFavorite) {
      return {
        shouldPush: true,
        priority: 'medium',
        reason: 'favorite_contact',
        contactContext,
      };
    }

    // Direct reports (team members) - check if urgent
    if (contactContext.isMyDirectReport && additionalContext?.hasUrgentKeywords) {
      return {
        shouldPush: true,
        priority: 'medium',
        reason: 'team_member_urgent',
        contactContext,
      };
    }

    // Internal colleagues - moderate priority
    if (contactContext.isInternal && additionalContext?.isDirectRecipient) {
      return {
        shouldPush: true,
        priority: 'low',
        reason: 'internal_colleague',
        contactContext,
      };
    }

    // Default to pull for unknown/external
    return {
      shouldPush: false,
      priority: 'low',
      reason: 'default_pull',
      contactContext,
    };
  }

  /**
   * Create new sender prompt for progressive disclosure
   */
  createNewSenderPrompt(email: string, name?: string): NewSenderPrompt {
    const contactContext = this.getContactContext(email);
    const isInternal = this.isSameDomain(email);

    // Cast to the limited set since new senders can only be push/pull/ask
    let suggestedAction: 'push' | 'pull' | 'ask' = 'pull';
    let reason = 'new_sender_external';

    if (isInternal) {
      suggestedAction = 'ask';
      reason = 'new_sender_internal';
    }

    return {
      senderEmail: email,
      senderName: name,
      detectedInfo: {
        inContacts: contactContext.exists,
        companyName: contactContext.companyName,
        jobTitle: contactContext.jobTitle,
        isInternal,
      },
      suggestedAction,
      reason,
    };
  }

  /**
   * Set push preference for a contact
   */
  setPushPreference(email: string, preference: ContactPushPreference): boolean {
    const contact = this.contactSyncService.getContactByEmail(email);
    if (!contact) return false;

    contact.pushPreference = preference;
    contact.updatedAt = Date.now();
    return true;
  }

  /**
   * Get all contacts with a specific push preference
   */
  getContactsByPreference(preference: ContactPushPreference): Contact[] {
    const allContacts = this.contactSyncService.getAllContacts();
    return allContacts.filter((c) => c.pushPreference === preference);
  }

  /**
   * Get manager, executives, and direct reports (CYA contacts)
   */
  getCYAContacts(): {
    manager: Contact | null;
    executives: Contact[];
    directReports: Contact[];
  } {
    const allContacts = this.contactSyncService.getAllContacts();

    return {
      manager: allContacts.find((c) => c.isMyManager) || null,
      executives: allContacts.filter((c) => c.isExecutive),
      directReports: allContacts.filter((c) => c.isMyDirectReport),
    };
  }

  /**
   * Compute suggested action based on contact properties
   */
  private computeSuggestedAction(contact: Contact): 'push' | 'pull' | 'ask' {
    // Auto-detected CYA contacts
    if (contact.isMyManager || contact.isExecutive) {
      return 'push';
    }

    // User's explicit preference
    if (contact.pushPreference === 'push' || contact.pushPreference === 'pull') {
      return contact.pushPreference;
    }

    // High relevance + internal
    if (contact.relevanceScore >= 7 && contact.isInternal) {
      return 'push';
    }

    // External with low relevance
    if (!contact.isInternal && contact.relevanceScore < 3) {
      return 'pull';
    }

    // Medium relevance - ask user
    return 'ask';
  }

  /**
   * Get human-readable reason for suggested action
   */
  private getReason(contact: Contact, action: 'push' | 'pull' | 'ask'): string {
    if (contact.isMyManager) return 'your_manager';
    if (contact.isExecutive) return 'executive';
    if (contact.pushPreference === 'push') return 'user_designated_push';
    if (contact.pushPreference === 'pull') return 'user_designated_pull';
    if (contact.isFavorite) return 'favorite_contact';
    if (contact.relevanceScore >= 7) return 'frequent_contact';
    if (contact.isInternal) return 'internal_colleague';
    return 'default_pull';
  }

  /**
   * Check if email is from the same domain as user
   */
  private isSameDomain(email: string): boolean {
    if (!this.userDomain || !email) return false;
    const emailDomain = email.split('@')[1]?.toLowerCase();
    return emailDomain === this.userDomain.toLowerCase();
  }
}

// Singleton instance
let providerInstance: RelationshipContextProvider | null = null;

/**
 * Get or create the RelationshipContextProvider singleton
 */
export function getRelationshipContextProvider(): RelationshipContextProvider {
  if (!providerInstance) {
    providerInstance = new RelationshipContextProvider();
  }
  return providerInstance;
}
