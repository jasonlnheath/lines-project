/**
 * Push/Pull Preferences API
 * GET: List preferences
 * POST: Create preference
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPushPullService } from '@/services/pushPull/pushPullService';
import { PreferenceQuery } from '@/services/pushPull/types';

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
 * GET /api/pushpull/preferences
 * Query parameters:
 * - type: 'sender' | 'subject' (optional)
 * - value: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'sender' | 'subject' | null;
    const value = searchParams.get('value');

    const service = getPushPullService();
    const query: PreferenceQuery = { userId };
    if (type) query.type = type;
    if (value) query.value = value;

    const preferences = await service.queryPreferences(query);

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('[GET /api/pushpull/preferences] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pushpull/preferences
 * Body: { type: 'sender' | 'subject', value: string, mode: 'push' | 'pull' }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { type, value, mode } = body;

    if (!type || !value || !mode) {
      return NextResponse.json(
        { error: 'type, value, and mode are required' },
        { status: 400 }
      );
    }

    if (!['sender', 'subject'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be "sender" or "subject"' },
        { status: 400 }
      );
    }

    if (!['push', 'pull'].includes(mode)) {
      return NextResponse.json(
        { error: 'mode must be "push" or "pull"' },
        { status: 400 }
      );
    }

    const service = getPushPullService();

    // Check if preference already exists
    const existingPrefs = await service.queryPreferences({ userId, type });
    const existing = existingPrefs.find(
      (p) => p.value.toLowerCase() === value.toLowerCase()
    );

    // If force flag is set, delete existing and create new
    if (existing && body.force === true) {
      await service.deletePreference(userId, existing.id);
    } else if (existing) {
      // Return existing preference with flag indicating it's a duplicate
      return NextResponse.json({
        error: 'Preference already exists',
        existingPreference: existing,
        code: 'DUPLICATE_PREFERENCE'
      }, { status: 409 });
    }

    const preference = await service.setPreference(userId, type, value, mode);

    return NextResponse.json({ preference });
  } catch (error) {
    console.error('[POST /api/pushpull/preferences] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save preference' },
      { status: 500 }
    );
  }
}
