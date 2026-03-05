/**
 * Graph API Utilities
 * Helper functions for graph API routes
 */

import { NextRequest } from 'next/server';

/**
 * Extract user ID from request
 * Uses the same pattern as other API routes in the app (cookie-based auth)
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // Get user info from cookies (same pattern as agent/query route)
    const userInfo = request.cookies.get('user_info')?.value;
    const user = userInfo ? JSON.parse(userInfo) : null;

    if (!user || !user.id) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('[getUserIdFromRequest] Error:', error);
    return null;
  }
}
