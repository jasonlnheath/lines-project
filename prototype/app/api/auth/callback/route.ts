import { NextRequest, NextResponse } from 'next/server';

/**
 * OAuth callback handler
 * Exchange auth code for access token
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Check for errors
  if (error) {
    return NextResponse.json(
      { error, errorDescription },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: 'No authorization code received' },
      { status: 400 }
    );
  }

  // Get stored verifier and state from cookies
  const verifier = request.cookies.get('cv')?.value;
  const storedState = request.cookies.get('st')?.value;

  if (!verifier || !storedState) {
    return NextResponse.json(
      { error: 'Missing PKCE verification data' },
      { status: 400 }
    );
  }

  // Validate state to prevent CSRF
  if (state !== storedState) {
    return NextResponse.json(
      { error: 'Invalid state parameter' },
      { status: 400 }
    );
  }

  // Exchange code for tokens
  const tokenResponse = await exchangeCodeForTokens(code, verifier);

  if (tokenResponse.error) {
    return NextResponse.json(tokenResponse, { status: 400 });
  }

  // Calculate token expiration
  const expiresAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;

  // Create token data object
  const tokenData = {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt,
    scope: tokenResponse.scope?.split(' ') || [],
  };

  // Get user info
  const userInfo = await getUserInfo(tokenData.accessToken);

  // Create response redirecting to home with tokens
  const response = NextResponse.redirect(new URL('/', request.url));

  // Store tokens in secure cookie
  response.cookies.set('auth_tokens', JSON.stringify(tokenData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  // Store user info in cookie
  response.cookies.set('user_info', JSON.stringify(userInfo), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  // Clear PKCE cookies
  response.cookies.delete('cv');
  response.cookies.delete('st');

  return response;
}

/**
 * Exchange authorization code for access tokens
 */
async function exchangeCodeForTokens(code: string, verifier: string) {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID || 'common';
  const redirectUri = process.env.AZURE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId!,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error_description || 'Token exchange failed' };
    }

    return data;
  } catch (error) {
    return { error: 'Network error during token exchange' };
  }
}

/**
 * Get user info from Microsoft Graph API
 */
async function getUserInfo(accessToken: string) {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return { error: 'Failed to fetch user info' };
    }

    const data = await response.json();
    return {
      id: data.id,
      displayName: data.displayName,
      email: data.mail || data.userPrincipalName,
    };
  } catch (error) {
    return { error: 'Failed to fetch user info' };
  }
}
