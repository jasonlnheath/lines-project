/**
 * User Persona Types
 * Defines user profile/persona information for the email agent
 */

/**
 * User persona captured during onboarding
 */
export interface UserPersona {
  userId: string;                    // Microsoft Graph user ID
  displayName: string;               // From Microsoft Graph
  email: string;                     // From Microsoft Graph
  role?: string;                     // User's job role (from onboarding)
  company?: string;                  // Company name (from onboarding)
  additionalContext?: string;        // Free-form additional info
  onboardingCompleted: boolean;      // Whether user finished onboarding
  createdAt: number;                 // Timestamp
  updatedAt: number;                 // Timestamp
}

/**
 * Onboarding request from user
 */
export interface OnboardingRequest {
  role: string;
  company: string;
  additionalContext?: string;
}

/**
 * Onboarding response from API
 */
export interface OnboardingResponse {
  success: boolean;
  persona?: UserPersona;
}

/**
 * Persona status response
 */
export interface PersonaStatus {
  onboardingCompleted: boolean;
  displayName?: string;
  role?: string;
  company?: string;
}
