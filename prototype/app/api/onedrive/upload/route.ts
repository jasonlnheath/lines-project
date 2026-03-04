import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, ensureArchiveFolders } from '@/services/onedrive';

/**
 * Upload file to OneDrive
 */
export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folderId = formData.get('folderId') as string | null;
    const useArchive = formData.get('useArchive') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    let targetFolderId = folderId || undefined;

    // If using archive structure, get/create folders
    if (useArchive) {
      const { archiveFolder } = await ensureArchiveFolders(accessToken);
      targetFolderId = archiveFolder.id;
    }

    const result = await uploadFile(
      accessToken,
      file.name,
      await file.arrayBuffer(),
      file.type || 'application/octet-stream',
      targetFolderId
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        file: {
          id: result.id,
          name: result.name,
          webUrl: result.webUrl,
        },
      });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
