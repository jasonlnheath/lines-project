/**
 * Persona Storage
 * Cookie-based storage for user persona (MVP)
 * Can be migrated to database later
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserPersona } from './personaTypes';

const PERSONA_COOKIE_NAME = 'user_persona';
const COOKIE_MAX_AGE_DAYS = 30;

/**
 * Get persona from request cookie
 */
export function getPersonaFromRequest(request: NextRequest): UserPersona | null {
  const personaCookie = request.cookies.get(PERSONA_COOKIE_NAME)?.value;

  if (!personaCookie) {
    return null;
  }

  try {
    return JSON.parse(personaCookie) as UserPersona;
  } catch (error) {
    console.error('[personaStorage] Failed to parse persona cookie:', error);
    return null;
  }
}

/**
 * Set persona cookie on response
 */
export function setPersonaOnResponse(response: NextResponse, persona: UserPersona): void {
  const cookieValue = JSON.stringify(persona);

  response.cookies.set(PERSONA_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(Date.now() + COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000),
    path: '/',
  });
}

/**
 * Create a new persona object
 */
export function createPersona(
  userId: string,
  displayName: string,
  email: string,
  role?: string,
  company?: string,
  additionalContext?: string
): UserPersona {
  const now = Date.now();

  return {
    userId,
    displayName,
    email,
    role,
    company,
    additionalContext,
    onboardingCompleted: !!role && !!company,  // Completed if both role and company provided
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update existing persona with new information
 */
export function updatePersona(
  existing: UserPersona,
  updates: Partial<Pick<UserPersona, 'role' | 'company' | 'additionalContext'>>
): UserPersona {
  return {
    ...existing,
    ...updates,
    onboardingCompleted: !!(updates.role || existing.role) && !!(updates.company || existing.company),
    updatedAt: Date.now(),
  };
}

/**
 * Format persona for display in prompts
 */
export function formatPersonaForPrompt(persona: UserPersona | null | undefined): string {
  if (!persona) {
    return 'No user context available.';
  }

  const parts: string[] = [];

  if (persona.displayName) {
    parts.push(`Name: ${persona.displayName}`);
  }

  if (persona.role) {
    parts.push(`Role: ${persona.role}`);
  }

  if (persona.company) {
    parts.push(`Company: ${persona.company}`);
  }

  if (persona.additionalContext) {
    parts.push(`Additional Context: ${persona.additionalContext}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No user context available.';
}
