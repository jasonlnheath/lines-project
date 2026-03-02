/**
 * OneDrive Service
 * Integration for OneDrive file operations
 */

import { graphEndpoints } from './msalConfig';

export interface OneDriveItem {
  id: string;
  name: string;
  folder?: { childCount?: number };
  file?: {};
  size?: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl: string;
}

export interface OneDriveFolder {
  id: string;
  name: string;
  childCount?: number;
  webUrl: string;
}

export interface UploadResult {
  success: boolean;
  id?: string;
  name?: string;
  webUrl?: string;
  error?: string;
}

/**
 * List OneDrive folders
 */
export async function listFolders(accessToken: string): Promise<OneDriveFolder[]> {
  try {
    const response = await fetch(
      `${graphEndpoints.driveRoot}/children?$filter=folder ne null&$select=id,name,folder,webUrl`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list folders: ${response.statusText}`);
    }

    const data: { value: OneDriveItem[] } = await response.json();

    return (data.value || []).map(item => ({
      id: item.id,
      name: item.name,
      childCount: item.folder?.childCount,
      webUrl: item.webUrl,
    }));
  } catch (error) {
    console.error('Error listing OneDrive folders:', error);
    throw error;
  }
}

/**
 * Create a new folder in OneDrive
 */
export async function createFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<OneDriveFolder> {
  try {
    const endpoint = parentFolderId
      ? `${graphEndpoints.driveRoot}/items/${parentFolderId}/children`
      : `${graphEndpoints.driveRoot}/children`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create folder: ${response.statusText}`);
    }

    const data: OneDriveItem = await response.json();

    return {
      id: data.id,
      name: data.name,
      webUrl: data.webUrl,
    };
  } catch (error) {
    console.error('Error creating OneDrive folder:', error);
    throw error;
  }
}

/**
 * Upload a file to OneDrive
 */
export async function uploadFile(
  accessToken: string,
  fileName: string,
  content: Blob | ArrayBuffer,
  contentType: string,
  folderId?: string
): Promise<UploadResult> {
  try {
    const endpoint = folderId
      ? `${graphEndpoints.driveRoot}/items/${folderId}:/${encodeURIComponent(fileName)}:/content`
      : `${graphEndpoints.driveRoot}:/${encodeURIComponent(fileName)}:/content`;

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: content,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error?.message || `Upload failed: ${response.statusText}`,
      };
    }

    const data: OneDriveItem = await response.json();

    return {
      success: true,
      id: data.id,
      name: data.name,
      webUrl: data.webUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: `Upload error: ${error}`,
    };
  }
}

/**
 * Get a specific item from OneDrive by ID
 */
export async function getItem(accessToken: string, itemId: string): Promise<OneDriveItem> {
  try {
    const response = await fetch(
      `${graphEndpoints.driveRoot}/items/${itemId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get item: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting OneDrive item:', error);
    throw error;
  }
}

/**
 * Download file content from OneDrive
 */
export async function downloadFile(accessToken: string, itemId: string): Promise<Blob> {
  try {
    const response = await fetch(
      `${graphEndpoints.driveRoot}/items/${itemId}/content`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error('Error downloading OneDrive file:', error);
    throw error;
  }
}

/**
 * Create Lines Archive folder structure
 */
export async function ensureArchiveFolders(accessToken: string): Promise<{
  archiveFolder: OneDriveFolder;
  attachmentsFolder: OneDriveFolder;
}> {
  try {
    // Get current year and quarter
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    const month = now.toLocaleString('default', { month: 'long' });

    // List existing folders
    const folders = await listFolders(accessToken);

    // Find or create "Lines Archive" folder
    let archiveFolder = folders.find(f => f.name === 'Lines Archive');
    if (!archiveFolder) {
      archiveFolder = await createFolder(accessToken, 'Lines Archive');
    }

    // Create year folder if needed
    const yearFolder = await createFolderIfNeeded(accessToken, archiveFolder.id, year.toString());

    // Create quarter folder if needed
    const quarterFolder = await createFolderIfNeeded(accessToken, yearFolder.id, `Q${quarter}`);

    // Create month folder if needed
    const monthFolder = await createFolderIfNeeded(accessToken, quarterFolder.id, month);

    // Create Attachments folder if needed
    let attachmentsFolder = folders.find(f => f.name === 'Attachments');
    if (!attachmentsFolder) {
      attachmentsFolder = await createFolder(accessToken, 'Attachments');
    }

    return {
      archiveFolder: monthFolder,
      attachmentsFolder,
    };
  } catch (error) {
    console.error('Error ensuring archive folders:', error);
    throw error;
  }
}

/**
 * Helper: Create folder if it doesn't exist
 */
async function createFolderIfNeeded(
  accessToken: string,
  parentFolderId: string,
  folderName: string
): Promise<OneDriveFolder> {
  try {
    // List children of parent folder
    const response = await fetch(
      `${graphEndpoints.driveRoot}/items/${parentFolderId}/children?$filter=folder ne null&$select=id,name,folder,webUrl`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list folders: ${response.statusText}`);
    }

    const data: { value: OneDriveItem[] } = await response.json();
    const existing = (data.value || []).find(f => f.name === folderName);

    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        webUrl: existing.webUrl,
      };
    }

    // Create the folder
    return await createFolder(accessToken, folderName, parentFolderId);
  } catch (error) {
    console.error('Error creating folder if needed:', error);
    throw error;
  }
}
