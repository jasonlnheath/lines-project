import { NextRequest, NextResponse } from 'next/server';

/**
 * Logout - clear tokens and redirect
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url));

  // Clear auth cookies
  response.cookies.delete('refresh_data');
  response.cookies.delete('user_info');
  // Clear PKCE cookies
  response.cookies.delete('cv');
  response.cookies.delete('st');

  return response;
}
