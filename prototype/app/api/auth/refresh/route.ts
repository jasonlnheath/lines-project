import { NextRequest, NextResponse } from 'next/server';

/**
 * Refresh access token using refresh token
 */
export async function POST(request: NextRequest) {
  try {
    const tokens = request.cookies.get('auth_tokens')?.value;

    if (!tokens) {
      return NextResponse.json(
        { error: 'No tokens found' },
        { status: 401 }
      );
    }

    const tokenData = JSON.parse(tokens);
    const { refreshToken } = tokenData;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 401 }
      );
    }

    // Exchange refresh token for new access token
    const newTokens = await refreshAccessToken(refreshToken);

    if (newTokens.error) {
      // Clear invalid tokens
      const response = NextResponse.json(newTokens, { status: 401 });
      response.cookies.delete('auth_tokens');
      return response;
    }

    // Calculate new expiration
    const expiresAt = Date.now() + (newTokens.expires_in || 3600) * 1000;

    const updatedTokenData = {
      ...tokenData,
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token || refreshToken,
      expiresAt,
    };

    // Update token cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('auth_tokens', JSON.stringify(updatedTokenData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID || 'common';

  const params = new URLSearchParams({
    client_id: clientId!,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
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
      return { error: data.error_description || 'Token refresh failed' };
    }

    return data;
  } catch (error) {
    return { error: 'Network error during token refresh' };
  }
}
