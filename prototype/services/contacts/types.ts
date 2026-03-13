/**
 * Contact Relationship Types
 *
 * Types for the agent-driven contact learning system.
 * No manual tags - the agent learns through onboarding and auto-detection.
 */

/**
 * Push/pull preference for a contact
 * Simple binary choice - no complex tagging system
 */
export type ContactPushPreference = 'push' | 'pull' | 'ask' | 'unset';

/**
 * Source of contact data
 */
export type ContactSource = 'outlook' | 'people_api' | 'ios_contacts' | 'manual';

/**
 * Person type from Microsoft Graph People API
 */
export interface PersonType {
  class: 'Person' | 'Other';
  subclass: 'OrganizationUser' | 'PersonalContact' | string;
}

/**
 * Contact model - unified across all sources
 *
 * Key design principle: pushPreference is the ONLY user-controlled field.
 * Everything else is auto-detected from Graph API or iOS Contacts.
 */
export interface Contact {
  // Identity
  id: string;
  emailAddresses: string[];
  phoneNumbers: string[]; // For SMS/voicemail matching (iOS future-proofing)

  // Basic info from Outlook/iOS Contacts
  displayName: string;
  companyName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;

  // Auto-detected relationships (NO manual tags)
  isMyManager: boolean; // From /me/manager endpoint
  isMyDirectReport: boolean; // From /me/directReports endpoint
  isExecutive: boolean; // C-level, VP, Owner in jobTitle
  isInternal: boolean; // Same email domain as user

  // People API signals
  relevanceScore: number; // 0-10, how often you communicate (from People API)
  isFavorite: boolean; // Starred in People API
  personType: PersonType; // From People API (internal vs external)

  // User-taught preferences (simple, not tags)
  pushPreference: ContactPushPreference;

  // Metadata
  sources: ContactSource[];
  lastSynced: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * User's role inferred from Graph API profile
 * Used for role-based onboarding questions
 */
export type InferredRole =
  | 'sales'
  | 'purchasing'
  | 'executive'
  | 'engineering'
  | 'support'
  | 'marketing'
  | 'finance'
  | 'hr'
  | 'operations'
  | 'legal'
  | 'other';

/**
 * User role detection result
 */
export interface UserRole {
  userId: string;
  department?: string;
  jobTitle?: string;
  inferredRole: InferredRole;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Onboarding question based on user role
 */
export interface OnboardingQuestion {
  category: string; // 'customers', 'vendors', 'partners', etc.
  suggestDefault: ContactPushPreference;
  explanation: string;
}

/**
 * Contact sync statistics
 */
export interface ContactSyncStats {
  totalContacts: number;
  outlookContacts: number;
  peopleApiContacts: number;
  iosContacts: number;
  mergedContacts: number;
  durationMs: number;
  lastSyncTime: number;
}

/**
 * Contact index for fast lookups
 */
export interface ContactIndex {
  byEmail: Map<string, Contact>; // Normalized email -> Contact
  byPhone: Map<string, Contact>; // Normalized phone -> Contact
  byId: Map<string, Contact>; // Contact ID -> Contact
}

/**
 * Contact enrichment result
 */
export interface ContactEnrichment {
  contactId: string;
  addedFields: string[];
  updatedFields: string[];
  sources: ContactSource[];
}

/**
 * Progressive disclosure prompt for new sender
 */
export interface NewSenderPrompt {
  senderEmail: string;
  senderName?: string;
  detectedInfo: {
    inContacts: boolean;
    companyName?: string;
    jobTitle?: string;
    isInternal: boolean;
  };
  suggestedAction: ContactPushPreference;
  reason: string;
}
