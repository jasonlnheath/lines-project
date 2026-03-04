import { NextRequest, NextResponse } from 'next/server';
import { listFolders } from '@/services/onedrive';

/**
 * Get list of OneDrive folders
 */
export async function GET(request: NextRequest) {
  try {
    const refreshData = request.cookies.get('refresh_data')?.value;

    if (!refreshData) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const data = JSON.parse(refreshData);
    const { refreshToken, expiresAt } = data;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 401 }
      );
    }

    // Check if token is expired (with 5 min buffer)
    if (Date.now() >= expiresAt - 300000) {
      return NextResponse.json(
        { error: 'Token expired', refreshRequired: true },
        { status: 401 }
      );
    }

    // Get fresh access token by calling refresh endpoint
    const cookieHeader = request.headers.get('cookie');

    const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
    });

    if (!refreshResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to refresh access token' },
        { status: 401 }
      );
    }

    const refreshDataResult = await refreshResponse.json();

    if (refreshDataResult.error) {
      return NextResponse.json(
        { error: refreshDataResult.error },
        { status: 401 }
      );
    }

    const accessToken = refreshDataResult.accessToken;

    const folders = await listFolders(accessToken);

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Error listing folders:', error);
    return NextResponse.json(
      { error: 'Failed to list folders' },
      { status: 500 }
    );
  }
}
