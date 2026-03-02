'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

interface OneDriveFolder {
  id: string;
  name: string;
  childCount?: number;
  webUrl: string;
}

export function OneDriveTest() {
  const { authenticated } = useAuth();
  const [folders, setFolders] = useState<OneDriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [useArchive, setUseArchive] = useState(false);

  const handleListFolders = async () => {
    setLoading(true);
    setError(null);
    setUploadResult(null);

    try {
      const response = await fetch('/api/onedrive/folders');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to list folders');
      }
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list folders');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (selectedFolder) {
        formData.append('folderId', selectedFolder);
      }
      if (useArchive) {
        formData.append('useArchive', 'true');
      }

      const response = await fetch('/api/onedrive/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      setUploadResult(data.file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">OneDrive Integration Test</h3>

      {!authenticated && (
        <p className="text-sm text-gray-500">
          Please login with Microsoft to test OneDrive integration
        </p>
      )}

      {authenticated && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={handleListFolders}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              {loading ? 'Loading...' : 'List Folders'}
            </button>
          </div>

          {folders.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Folders ({folders.length})</h4>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2">
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Root folder</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                      {folder.childCount !== undefined && ` (${folder.childCount} items)`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Upload Test File</h4>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full p-2 border rounded-lg mb-2"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useArchive}
                onChange={(e) => setUseArchive(e.target.checked)}
                className="rounded"
              />
              Use Lines Archive folder structure (Year/Quarter/Month)
            </label>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || loading}
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
            >
              {loading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>

          {uploadResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-medium text-green-800">File uploaded successfully!</p>
              <p className="text-xs text-green-700 mt-1">
                Name: {uploadResult.name}
              </p>
              <a
                href={uploadResult.webUrl}
                target="_blank"
                rel="noopener"
                className="text-xs text-blue-600 underline"
              >
                View in OneDrive
              </a>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
