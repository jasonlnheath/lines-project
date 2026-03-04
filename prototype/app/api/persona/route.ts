/**
 * Persona API Endpoint
 * Handles persona CRUD operations
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPersonaFromRequest,
  setPersonaOnResponse,
  createPersona,
  updatePersona,
} from '@/services/agent/persona/personaStorage';
import { UserPersona, OnboardingRequest } from '@/services/agent/persona/personaTypes';

/**
 * GET /api/persona
 * Returns current persona status
 */
export async function GET(request: NextRequest) {
  try {
    const persona = getPersonaFromRequest(request);

    if (!persona) {
      return NextResponse.json({
        onboardingCompleted: false,
      });
    }

    return NextResponse.json({
      onboardingCompleted: persona.onboardingCompleted,
      displayName: persona.displayName,
      role: persona.role,
      company: persona.company,
    });
  } catch (error) {
    console.error('[GET /api/persona] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get persona status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/persona
 * Creates or updates user persona
 */
export async function POST(request: NextRequest) {
  try {
    // Get user info from auth cookie
    const userInfoCookie = request.cookies.get('user_info')?.value;
    if (!userInfoCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = JSON.parse(userInfoCookie);

    // Parse request body
    const body: OnboardingRequest = await request.json();

    // Validate required fields
    if (!body.role || !body.company) {
      return NextResponse.json(
        { error: 'Role and company are required' },
        { status: 400 }
      );
    }

    // Check if updating existing or creating new
    const existingPersona = getPersonaFromRequest(request);
    let persona: UserPersona;

    if (existingPersona) {
      // Update existing
      persona = updatePersona(existingPersona, {
        role: body.role,
        company: body.company,
        additionalContext: body.additionalContext,
      });
      console.log('[POST /api/persona] Updated persona for:', user.displayName);
    } else {
      // Create new
      persona = createPersona(
        user.id,
        user.displayName,
        user.email,
        body.role,
        body.company,
        body.additionalContext
      );
      console.log('[POST /api/persona] Created persona for:', user.displayName);
    }

    // Set cookie
    const response = NextResponse.json({
      success: true,
      persona: {
        displayName: persona.displayName,
        role: persona.role,
        company: persona.company,
      },
    });

    setPersonaOnResponse(response, persona);

    return response;
  } catch (error) {
    console.error('[POST /api/persona] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save persona' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/persona
 * Clears persona (for testing/debugging)
 */
export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true });

    response.cookies.delete({
      name: 'user_persona',
      path: '/',
    });

    console.log('[DELETE /api/persona] Cleared persona');

    return response;
  } catch (error) {
    console.error('[DELETE /api/persona] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clear persona' },
      { status: 500 }
    );
  }
}
