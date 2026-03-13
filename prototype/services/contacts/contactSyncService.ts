/**
 * Contact Sync Service
 *
 * Syncs contacts from multiple sources:
 * - Microsoft Graph Contacts (Outlook)
 * - Microsoft Graph People API (relevance-ranked)
 * - Microsoft Graph Manager/Direct Reports (org hierarchy)
 * - iOS Contacts (future: for SMS/voicemail matching)
 */

import {
  Contact,
  ContactIndex,
  ContactSyncStats,
  ContactSource,
  PersonType,
} from './types';

/**
 * Microsoft Graph Contact response
 */
interface GraphContact {
  id: string;
  displayName?: string;
  companyName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  emailAddresses?: Array<{ address: string }>;
  businessPhones?: string[];
  mobilePhone?: string;
}

/**
 * Microsoft Graph Person response (People API)
 */
interface GraphPerson {
  id: string;
  displayName?: string;
  companyName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  scoredEmailAddresses?: Array<{ address: string; relevanceScore?: number }>;
  personType: PersonType;
  isFavorite?: boolean;
}

/**
 * Microsoft Graph Directory User (for manager/direct reports)
 */
interface GraphUser {
  id: string;
  displayName?: string;
  mail?: string;
  jobTitle?: string;
  department?: string;
}

/**
 * User profile for domain matching
 */
interface UserProfile {
  id: string;
  mail?: string;
  userPrincipalName?: string;
}

/**
 * Contact sync service configuration
 */
export interface ContactSyncConfig {
  userId: string;
  userEmail?: string;
  userDomain?: string;
  graphClient: any; // Microsoft Graph Client
  enablePeopleApi: boolean;
  enableOrgHierarchy: boolean;
}

/**
 * Contact Sync Service
 *
 * Merges contacts from multiple sources into a unified index.
 */
export class ContactSyncService {
  private config: ContactSyncConfig | null = null;
  private contactIndex: ContactIndex = {
    byEmail: new Map(),
    byPhone: new Map(),
    byId: new Map(),
  };

  /**
   * Set configuration for sync service
   */
  setConfig(config: ContactSyncConfig): void {
    this.config = config;
  }

  /**
   * Full sync from all sources
   */
  async syncAll(): Promise<ContactSyncStats> {
    if (!this.config) {
      throw new Error('ContactSyncService not configured');
    }

    const startTime = performance.now();
    const stats: ContactSyncStats = {
      totalContacts: 0,
      outlookContacts: 0,
      peopleApiContacts: 0,
      iosContacts: 0,
      mergedContacts: 0,
      durationMs: 0,
      lastSyncTime: Date.now(),
    };

    // 1. Fetch Outlook contacts
    const outlookContacts = await this.fetchOutlookContacts();
    stats.outlookContacts = outlookContacts.length;

    // 2. Fetch People API contacts
    let peopleApiContacts: GraphPerson[] = [];
    if (this.config.enablePeopleApi) {
      peopleApiContacts = await this.fetchPeopleApiContacts();
      stats.peopleApiContacts = peopleApiContacts.length;
    }

    // 3. Fetch org hierarchy (manager, direct reports)
    let managerInfo: GraphUser | null = null;
    let directReports: GraphUser[] = [];
    if (this.config.enableOrgHierarchy) {
      [managerInfo, directReports] = await Promise.all([
        this.fetchManager(),
        this.fetchDirectReports(),
      ]);
    }

    // 4. Merge all contacts
    this.contactIndex = this.mergeContacts({
      outlookContacts,
      peopleApiContacts,
      managerInfo,
      directReports,
    });

    stats.totalContacts = this.contactIndex.byId.size;
    stats.mergedContacts = stats.totalContacts;
    stats.durationMs = performance.now() - startTime;
    stats.lastSyncTime = Date.now();

    return stats;
  }

  /**
   * Get contact by email address
   */
  getContactByEmail(email: string): Contact | null {
    const normalized = this.normalizeEmail(email);
    return this.contactIndex.byEmail.get(normalized) || null;
  }

  /**
   * Get contact by phone number
   */
  getContactByPhone(phone: string): Contact | null {
    const normalized = this.normalizePhone(phone);
    return this.contactIndex.byPhone.get(normalized) || null;
  }

  /**
   * Get contact by ID
   */
  getContactById(id: string): Contact | null {
    return this.contactIndex.byId.get(id) || null;
  }

  /**
   * Get all contacts
   */
  getAllContacts(): Contact[] {
    return Array.from(this.contactIndex.byId.values());
  }

  /**
   * Fetch Outlook contacts from Graph API
   */
  private async fetchOutlookContacts(): Promise<GraphContact[]> {
    if (!this.config) return [];

    try {
      // Note: In production, use proper pagination
      const response = await this.config.graphClient
        .api('/me/contacts')
        .select('id,displayName,companyName,jobTitle,department,officeLocation,emailAddresses,businessPhones,mobilePhone')
        .top(999) // Maximum for single request
        .get();

      return response.value || [];
    } catch (error) {
      console.error('Error fetching Outlook contacts:', error);
      return [];
    }
  }

  /**
   * Fetch People API contacts (relevance-ranked)
   */
  private async fetchPeopleApiContacts(): Promise<GraphPerson[]> {
    if (!this.config) return [];

    try {
      const response = await this.config.graphClient
        .api('/me/people')
        .select('id,displayName,companyName,jobTitle,department,officeLocation,scoredEmailAddresses,personType,isFavorite')
        .top(50) // Most relevant 50
        .get();

      return response.value || [];
    } catch (error) {
      console.error('Error fetching People API contacts:', error);
      return [];
    }
  }

  /**
   * Fetch user's manager from Graph API
   */
  private async fetchManager(): Promise<GraphUser | null> {
    if (!this.config) return null;

    try {
      const response = await this.config.graphClient
        .api('/me/manager')
        .select('id,displayName,mail,jobTitle,department')
        .get();

      return response || null;
    } catch (error) {
      // Manager not found is OK (user might not have a manager)
      return null;
    }
  }

  /**
   * Fetch user's direct reports from Graph API
   */
  private async fetchDirectReports(): Promise<GraphUser[]> {
    if (!this.config) return [];

    try {
      const response = await this.config.graphClient
        .api('/me/directReports')
        .select('id,displayName,mail,jobTitle,department')
        .get();

      return response.value || [];
    } catch (error) {
      console.error('Error fetching direct reports:', error);
      return [];
    }
  }

  /**
   * Merge contacts from all sources
   */
  private mergeContacts(options: {
    outlookContacts: GraphContact[];
    peopleApiContacts: GraphPerson[];
    managerInfo: GraphUser | null;
    directReports: GraphUser[];
  }): ContactIndex {
    const index: ContactIndex = {
      byEmail: new Map(),
      byPhone: new Map(),
      byId: new Map(),
    };

    const managerEmail = options.managerInfo?.mail?.toLowerCase();
    const directReportEmails = new Set(
      options.directReports.map((dr) => dr.mail?.toLowerCase()).filter(Boolean) as string[]
    );

    // Process Outlook contacts
    for (const graphContact of options.outlookContacts) {
      const contact = this.graphContactToContact(graphContact, {
        isMyManager: false,
        isMyDirectReport: false,
      });
      this.indexContact(contact, index);
    }

    // Process People API contacts (merge or add)
    for (const person of options.peopleApiContacts) {
      // Check if we already have this contact from Outlook
      const existingEmail = person.scoredEmailAddresses?.[0]?.address;
      if (existingEmail) {
        const normalized = this.normalizeEmail(existingEmail);
        const existing = index.byEmail.get(normalized);

        if (existing) {
          // Merge People API data into existing contact
          existing.relevanceScore = person.scoredEmailAddresses?.[0]?.relevanceScore || 0;
          existing.isFavorite = person.isFavorite || false;
          existing.personType = person.personType;
          existing.sources.push('people_api');
          existing.updatedAt = Date.now();
          continue;
        }
      }

      // New contact from People API
      const contact = this.graphPersonToContact(person, {
        isMyManager: managerEmail === person.scoredEmailAddresses?.[0]?.address?.toLowerCase(),
        isMyDirectReport: directReportEmails.has(
          person.scoredEmailAddresses?.[0]?.address?.toLowerCase() || ''
        ),
      });
      this.indexContact(contact, index);
    }

    return index;
  }

  /**
   * Convert Graph Contact to Contact model
   */
  private graphContactToContact(
    graphContact: GraphContact,
    orgInfo: { isMyManager: boolean; isMyDirectReport: boolean }
  ): Contact {
    const emails = graphContact.emailAddresses?.map((e) => e.address) || [];
    const phones = [
      ...(graphContact.businessPhones || []),
      graphContact.mobilePhone,
    ].filter(Boolean) as string[];

    const jobTitle = graphContact.jobTitle || '';
    const isExecutive = this.detectIsExecutive(jobTitle);

    return {
      id: `outlook-${graphContact.id}`,
      emailAddresses: emails,
      phoneNumbers: phones,
      displayName: graphContact.displayName || '',
      companyName: graphContact.companyName,
      jobTitle,
      department: graphContact.department,
      officeLocation: graphContact.officeLocation,
      isMyManager: orgInfo.isMyManager,
      isMyDirectReport: orgInfo.isMyDirectReport,
      isExecutive,
      isInternal: this.detectIsInternal(emails[0] || ''),
      relevanceScore: 0, // Will be enriched by People API
      isFavorite: false, // Will be enriched by People API
      personType: { class: 'Person', subclass: 'PersonalContact' },
      pushPreference: 'unset',
      sources: ['outlook'],
      lastSynced: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Convert Graph Person to Contact model
   */
  private graphPersonToContact(
    person: GraphPerson,
    orgInfo: { isMyManager: boolean; isMyDirectReport: boolean }
  ): Contact {
    const emails = person.scoredEmailAddresses?.map((e) => e.address) || [];

    const jobTitle = person.jobTitle || '';
    const isExecutive = this.detectIsExecutive(jobTitle);

    return {
      id: `people-${person.id}`,
      emailAddresses: emails,
      phoneNumbers: [],
      displayName: person.displayName || '',
      companyName: person.companyName,
      jobTitle,
      department: person.department,
      officeLocation: person.officeLocation,
      isMyManager: orgInfo.isMyManager,
      isMyDirectReport: orgInfo.isMyDirectReport,
      isExecutive,
      isInternal: this.detectIsInternal(emails[0] || ''),
      relevanceScore: person.scoredEmailAddresses?.[0]?.relevanceScore || 0,
      isFavorite: person.isFavorite || false,
      personType: person.personType,
      pushPreference: 'unset',
      sources: ['people_api'],
      lastSynced: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Index a contact for fast lookups
   */
  private indexContact(contact: Contact, index: ContactIndex): void {
    index.byId.set(contact.id, contact);

    for (const email of contact.emailAddresses) {
      const normalized = this.normalizeEmail(email);
      index.byEmail.set(normalized, contact);
    }

    for (const phone of contact.phoneNumbers) {
      const normalized = this.normalizePhone(phone);
      index.byPhone.set(normalized, contact);
    }
  }

  /**
   * Normalize email address for lookup
   */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Normalize phone number for lookup
   */
  private normalizePhone(phone: string): string {
    // Remove all non-numeric characters
    return phone.replace(/\D/g, '');
  }

  /**
   * Detect if contact is internal (same domain as user)
   */
  private detectIsInternal(email: string): boolean {
    if (!this.config || !this.config.userDomain || !email) return false;
    const emailDomain = email.split('@')[1]?.toLowerCase();
    return emailDomain === this.config.userDomain.toLowerCase();
  }

  /**
   * Detect if job title indicates executive level
   */
  private detectIsExecutive(jobTitle: string): boolean {
    if (!jobTitle) return false;
    const title = jobTitle.toLowerCase();

    // C-level titles
    if (/^(ceo|cio|cto|cfo|coo|cmo|cro|cso|cpo|clo|)\b/.test(title)) return true;
    if (title.includes('chief ')) return true;

    // VP titles
    if (title.includes('vice president')) return true;
    if (title.startsWith('vp') || title.startsWith('vp.')) return true;

    // Owner/founder
    if (title.includes('owner')) return true;
    if (title.includes('founder')) return true;
    if (title.includes('president')) return true;
    if (title.includes('director')) return true;

    return false;
  }
}

// Re-export Contact type for convenience
export type { Contact } from './types';

// Singleton instance
let syncServiceInstance: ContactSyncService | null = null;

/**
 * Get or create the ContactSyncService singleton
 */
export function getContactSyncService(): ContactSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new ContactSyncService();
  }
  return syncServiceInstance;
}
