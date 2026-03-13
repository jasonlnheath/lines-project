/**
 * Onboarding Types
 *
 * Types for the agent-driven onboarding system.
 * The agent learns user preferences through role-based questions.
 */

import { Contact, ContactPushPreference } from '../contacts/types';

/**
 * Inferred user role based on Graph API profile
 */
export type UserRole =
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
  | 'it'
  | 'product'
  | 'other';

/**
 * Confidence level for role detection
 */
export type DetectionConfidence = 'high' | 'medium' | 'low';

/**
 * Role detection result
 */
export interface RoleDetection {
  userId: string;
  inferredRole: UserRole;
  confidence: DetectionConfidence;
  signals: {
    department?: string;
    jobTitle?: string;
    managerTitle?: string;
    directReportCount?: number;
  };
}

/**
 * Onboarding question category
 */
export type QuestionCategory =
  | 'customers'
  | 'prospects'
  | 'vendors'
  | 'partners'
  | 'team'
  | 'executives'
  | 'media'
  | 'investors'
  | 'board'
  | 'internal';

/**
 * Onboarding question
 */
export interface OnboardingQuestion {
  id: string;
  category: QuestionCategory;
  question: string;
  context?: string;
  suggestedDefault: ContactPushPreference;
  options: OnboardingQuestionOption[];
}

/**
 * Onboarding question option
 */
export interface OnboardingQuestionOption {
  label: string;
  value: ContactPushPreference;
  description?: string;
}

/**
 * User's answer to an onboarding question
 */
export interface OnboardingAnswer {
  questionId: string;
  category: QuestionCategory;
  selectedPreference: ContactPushPreference;
  specificContacts?: string[]; // Optional: specific email addresses
  companyDomains?: string[]; // Optional: company domains for this category
}

/**
 * Pre-filled contact from auto-detection
 */
export interface PreFilledContact {
  email: string;
  name?: string;
  relationship: 'manager' | 'executive' | 'direct_report';
  suggestedPreference: ContactPushPreference;
  reason: string;
}

/**
 * Onboarding state
 */
export interface OnboardingState {
  userId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  roleDetection?: RoleDetection;
  preFilledContacts: PreFilledContact[];
  questions: OnboardingQuestion[];
  answers: OnboardingAnswer[];
  currentQuestionIndex: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Onboarding summary (final result)
 */
export interface OnboardingSummary {
  userId: string;
  role: UserRole;
  alwaysPushContacts: Array<{
    email: string;
    name?: string;
    reason: string;
  }>;
  companyRules: Array<{
    category: QuestionCategory;
    domains: string[];
    preference: ContactPushPreference;
  }>;
  defaultExternalBehavior: 'push' | 'pull' | 'ask';
  completedAt: number;
}

/**
 * Role-based question template
 */
export interface RoleQuestionTemplate {
  role: UserRole;
  displayName: string;
  description: string;
  categories: Array<{
    category: QuestionCategory;
    priority: number;
    suggestedDefault: ContactPushPreference;
    questionTemplate: string;
  }>;
}

/**
 * Graph API user profile (for role detection)
 */
export interface GraphUserProfile {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  companyName?: string;
}

/**
 * Graph API manager info
 */
export interface GraphManagerInfo {
  id: string;
  displayName?: string;
  mail?: string;
  jobTitle?: string;
  department?: string;
}

/**
 * Graph API organization info
 */
export interface GraphOrgInfo {
  user: GraphUserProfile;
  manager: GraphManagerInfo | null;
  directReports: GraphUserProfile[];
}
