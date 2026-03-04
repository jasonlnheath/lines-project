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
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.json(
      { error, errorDescription },
      { status: 400 }
    );
  }

  if (!code) {
    console.error('No authorization code received');
    return NextResponse.json(
      { error: 'No authorization code received' },
      { status: 400 }
    );
  }

  // Get stored verifier and state from cookies
  const verifier = request.cookies.get('cv')?.value;
  const storedState = request.cookies.get('st')?.value;

  if (!verifier || !storedState) {
    console.error('Missing PKCE verification data');
    return NextResponse.json(
      { error: 'Missing PKCE verification data' },
      { status: 400 }
    );
  }

  // Validate state to prevent CSRF
  if (state !== storedState) {
    console.error('Invalid state parameter');
    return NextResponse.json(
      { error: 'Invalid state parameter' },
      { status: 400 }
    );
  }

  // Exchange code for tokens
  const tokenResponse = await exchangeCodeForTokens(code, verifier);

  if (tokenResponse.error) {
    console.error('Token exchange failed:', tokenResponse.error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(tokenResponse.error)}`, request.url)
    );
  }

  console.log('Token exchange successful');

  // Calculate token expiration
  const expiresAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;

  // Get user info (using the access token now)
  const userInfo = await getUserInfo(tokenResponse.access_token);

  if (userInfo.error) {
    console.error('Failed to get user info:', userInfo.error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(userInfo.error)}`, request.url)
    );
  }

  console.log('User authenticated:', userInfo.email);

  // Store ONLY refresh token in cookie (access tokens are too large for cookies)
  // The access token will be refreshed when needed via /api/auth/refresh endpoint
  const refreshData = {
    refreshToken: tokenResponse.refresh_token,
    expiresAt,
  };

  const userInfoJson = JSON.stringify(userInfo);
  const refreshDataJson = JSON.stringify(refreshData);

  console.log('refresh_data JSON length:', refreshDataJson.length);
  console.log('user_info JSON length:', userInfoJson.length);

  // Create redirect response
  const response = NextResponse.redirect(new URL('/', request.url));

  // Calculate cookie expiration (30 days from now)
  const cookieExpiration = new Date();
  cookieExpiration.setDate(cookieExpiration.getDate() + 30);

  // Set auth cookies - only store refresh token (much smaller)
  console.log('Setting refresh_data cookie...');
  response.cookies.set('refresh_data', refreshDataJson, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: cookieExpiration,
    path: '/',
  });
  console.log('Setting user_info cookie...');
  response.cookies.set('user_info', userInfoJson, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: cookieExpiration,
    path: '/',
  });

  // Clear PKCE cookies
  response.cookies.delete('cv');
  response.cookies.delete('st');

  console.log('All cookies set, checking onboarding status...');

  // Check if user has completed onboarding
  // We'll use the current request (which has the cookies we just set)
  // to check persona status by making an internal call
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url.split('/api/auth/callback')[0];
    const personaCheckUrl = `${baseUrl}/api/persona`;

    // We can't use cookies directly from the response, so we'll add a URL parameter
    // The main page will check persona status via API call
    console.log('Redirecting to main page for onboarding check');
    return response;
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    // Continue with normal redirect if check fails
    return response;
  }
}

/**
 * Exchange authorization code for access tokens
 */
async function exchangeCodeForTokens(code: string, verifier: string) {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID || 'common';
  const redirectUri = process.env.AZURE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  console.log('Exchanging code for tokens...');

  const params = new URLSearchParams({
    client_id: clientId!,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  // Add client_secret if available (confidential client)
  if (clientSecret) {
    params.append('client_secret', clientSecret);
  }

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
      console.error('Token exchange API error:', data);
      return { error: data.error_description || 'Token exchange failed' };
    }

    console.log('Token exchange succeeded');
    return data;
  } catch (error) {
    console.error('Token exchange network error:', error);
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
      const data = await response.json();
      console.error('Graph API error:', data);
      return { error: 'Failed to fetch user info' };
    }

    const data = await response.json();
    return {
      id: data.id,
      displayName: data.displayName,
      email: data.mail || data.userPrincipalName,
    };
  } catch (error) {
    console.error('Get user info error:', error);
    return { error: 'Failed to fetch user info' };
  }
}
