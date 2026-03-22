/**
 * Push/Pull Preferences API
 * GET: List preferences
 * POST: Create preference
 *
 * Supports three preference types:
 * - sender: specific email addresses
 * - thread: specific conversation threads (by conversationId)
 * - line: topic lines/clusters (by lineId)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPushPullService } from '@/services/pushPull/pushPullService';
import { PreferenceQuery, PreferenceType } from '@/services/pushPull/types';

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

const VALID_TYPES: PreferenceType[] = ['sender', 'thread', 'line'];

/**
 * GET /api/pushpull/preferences
 * Query parameters:
 * - type: 'sender' | 'thread' | 'line' (optional)
 * - value: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as PreferenceType | null;
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
 * Body: { type: 'sender' | 'thread' | 'line', value: string, mode: 'push' | 'pull', isBoss?: boolean, isVIP?: boolean, name?: string }
 * If preference exists, updates it instead of creating duplicate
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { type, value, mode, isBoss, isVIP, name } = body;

    if (!type || !value) {
      return NextResponse.json(
        { error: 'type and value are required' },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'type must be "sender", "thread", or "line"' },
        { status: 400 }
      );
    }

    // Mode defaults to 'pull', but Boss/VIP always push
    const effectiveMode = (isBoss || isVIP) ? 'push' : (mode || 'pull');

    if (!['push', 'pull'].includes(effectiveMode)) {
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

    if (existing) {
      // Update existing preference instead of creating duplicate
      const updated = await service.updatePreferenceById(userId, existing.id, {
        mode: effectiveMode,
        ...(isBoss !== undefined && { isBoss }),
        ...(isVIP !== undefined && { isVIP }),
        ...(name !== undefined && { name }),
      });
      return NextResponse.json({ preference: updated });
    }

    // Create new preference with extended fields
    const preference = await service.setPreference(userId, type, value, effectiveMode, {
      ...(isBoss !== undefined && { isBoss }),
      ...(isVIP !== undefined && { isVIP }),
      ...(name !== undefined && { name }),
    });

    return NextResponse.json({ preference });
  } catch (error) {
    console.error('[POST /api/pushpull/preferences] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save preference' },
      { status: 500 }
    );
  }
}
