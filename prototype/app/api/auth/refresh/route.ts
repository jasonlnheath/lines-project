import { NextRequest, NextResponse } from 'next/server';

/**
 * Refresh access token using refresh token
 */
export async function POST(request: NextRequest) {
  try {
    const refreshData = request.cookies.get('refresh_data')?.value;

    console.log('/api/auth/refresh called');
    console.log('Has refresh_data:', !!refreshData);

    if (!refreshData) {
      console.log('No refresh_data cookie found');
      return NextResponse.json(
        { error: 'No refresh token found' },
        { status: 401 }
      );
    }

    const data = JSON.parse(refreshData);
    const { refreshToken } = data;

    console.log('Refresh token length:', refreshToken?.length);

    if (!refreshToken) {
      console.log('No refresh token in data');
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 401 }
      );
    }

    // Exchange refresh token for new access token
    console.log('Calling refreshAccessToken...');
    const newTokens = await refreshAccessToken(refreshToken);

    if (newTokens.error) {
      console.log('Refresh failed:', newTokens.error);
      // Clear invalid tokens
      const response = NextResponse.json(newTokens, { status: 401 });
      response.cookies.delete('refresh_data');
      return response;
    }

    // Calculate new expiration
    const expiresAt = Date.now() + (newTokens.expires_in || 3600) * 1000;

    console.log('Refresh succeeded, access token length:', newTokens.access_token?.length);

    // Return the access token directly (don't store in cookie - it's too large)
    return NextResponse.json({
      accessToken: newTokens.access_token,
      expiresAt,
      refreshToken: newTokens.refresh_token || refreshToken,
    });
  } catch (error) {
    console.log('Refresh exception:', error);
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
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  const params = new URLSearchParams({
    client_id: clientId!,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'User.Read Mail.Read Mail.ReadWrite Mail.Send Files.ReadWrite offline_access',
  });

  // Add client_secret if available (confidential client)
  if (clientSecret) {
    params.append('client_secret', clientSecret);
  }

  console.log('Token refresh request to Azure, tenant:', tenantId);

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

    console.log('Azure refresh response status:', response.status);

    if (!response.ok) {
      console.log('Azure refresh error:', data);
      return { error: data.error_description || 'Token refresh failed' };
    }

    console.log('Azure refresh succeeded');
    return data;
  } catch (error) {
    console.log('Network error:', error);
    return { error: 'Network error during token refresh' };
  }
}
