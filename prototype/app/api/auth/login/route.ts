import { NextRequest, NextResponse } from 'next/server';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/lib/auth';

/**
 * Initiate OAuth login flow
 * This redirects user to Microsoft login page
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID || 'common';
  const redirectUri = process.env.AZURE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

  if (!clientId) {
    return NextResponse.json({ error: 'Azure client ID not configured' }, { status: 500 });
  }

  // Generate PKCE parameters
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  // Store verifier and state in session/cookie for callback verification
  const response = NextResponse.redirect(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
    new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: [
        'User.Read',
        'Mail.Read',
        'Mail.ReadWrite',
        'Mail.Send',
        'Files.ReadWrite',
        'Files.ReadWrite.All',
        'offline_access',
      ].join(' '),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: state,
      response_mode: 'query',
    })
  );

  // Store verifier and state in cookies for callback verification
  response.cookies.set('cv', verifier, { httpOnly: true, secure: true, sameSite: 'lax' });
  response.cookies.set('st', state, { httpOnly: true, secure: true, sameSite: 'lax' });

  return response;
}
