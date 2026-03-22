/**
 * Bulk Import Preferences API
 * POST: Import multiple preferences at once
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPushPullService } from '@/services/pushPull/pushPullService';

interface BulkImportItem {
  type: 'sender' | 'subject';
  value: string;
  mode: 'push' | 'pull';
}

function getUserId(request: NextRequest): string | null {
  const userInfoCookie = request.cookies.get('user_info')?.value;
  if (!userInfoCookie) return null;

  try {
    const user = JSON.parse(userInfoCookie);
    return user.id;
  } catch {
    return null;
  }
}

/**
 * POST /api/pushpull/bulk-import
 * Body: { items: BulkImportItem[] }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items array is required' },
        { status: 400 }
      );
    }

    // Validate items
    for (const item of items) {
      if (!['sender', 'subject'].includes(item.type)) {
        return NextResponse.json(
          { error: `Invalid type: ${item.type}. Must be "sender" or "subject"` },
          { status: 400 }
        );
      }
      if (!item.value) {
        return NextResponse.json(
          { error: 'value is required for each item' },
          { status: 400 }
        );
      }
      if (!['push', 'pull'].includes(item.mode)) {
        return NextResponse.json(
          { error: `Invalid mode: ${item.mode}. Must be "push" or "pull"` },
          { status: 400 }
        );
      }
    }

    const service = getPushPullService();
    const result = await service.bulkImport(userId, items);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/pushpull/bulk-import] Error:', error);
    return NextResponse.json(
      { error: 'Failed to import preferences' },
      { status: 500 }
    );
  }
}
