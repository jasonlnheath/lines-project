import { NextRequest, NextResponse } from 'next/server';
import { listFolders } from '@/services/onedrive';

/**
 * Get list of OneDrive folders
 */
export async function GET(request: NextRequest) {
  try {
    const tokens = request.cookies.get('auth_tokens')?.value;

    if (!tokens) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const tokenData = JSON.parse(tokens);

    if (Date.now() >= tokenData.expiresAt - 300000) {
      return NextResponse.json(
        { error: 'Token expired', refreshRequired: true },
        { status: 401 }
      );
    }

    const folders = await listFolders(tokenData.accessToken);

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Error listing folders:', error);
    return NextResponse.json(
      { error: 'Failed to list folders' },
      { status: 500 }
    );
  }
}
