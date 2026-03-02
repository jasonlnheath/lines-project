import { NextRequest, NextResponse } from 'next/server';

/**
 * Logout - clear tokens and redirect
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url));

  // Clear auth cookies
  response.cookies.delete('auth_tokens');
  response.cookies.delete('user_info');

  return response;
}
