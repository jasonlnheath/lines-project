import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, ensureArchiveFolders } from '@/services/onedrive';

/**
 * Upload file to OneDrive
 */
export async function POST(request: NextRequest) {
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
      const { archiveFolder } = await ensureArchiveFolders(tokenData.accessToken);
      targetFolderId = archiveFolder.id;
    }

    const result = await uploadFile(
      tokenData.accessToken,
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
