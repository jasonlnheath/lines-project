/**
 * Single Preference API
 * GET: Get a single preference
 * PUT: Update a preference
 * DELETE: Remove a preference
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPushPullService } from '@/services/pushPull/pushPullService';

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
 * GET /api/pushpull/preferences/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Preference ID is required' }, { status: 400 });
    }

    const service = getPushPullService();
    const preference = await service.getPreferenceById(userId, id);

    if (!preference) {
      return NextResponse.json({ error: 'Preference not found' }, { status: 404 });
    }

    return NextResponse.json({ preference });
  } catch (error) {
    console.error('[GET /api/pushpull/preferences/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to get preference' }, { status: 500 });
  }
}

/**
 * PUT /api/pushpull/preferences/[id]
 * Update a preference (mode, isVIP, isBoss, etc.)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Preference ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { mode, isVIP, isBoss, name } = body;

    const service = getPushPullService();
    const updated = await service.updatePreferenceById(userId, id, {
      ...(mode && { mode }),
      ...(isVIP !== undefined && { isVIP }),
      ...(isBoss !== undefined && { isBoss }),
      ...(name !== undefined && { name }),
    });

    if (!updated) {
      return NextResponse.json({ error: 'Preference not found' }, { status: 404 });
    }

    return NextResponse.json({ preference: updated });
  } catch (error) {
    console.error('[PUT /api/pushpull/preferences/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 });
  }
}

/**
 * DELETE /api/pushpull/preferences/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Preference ID is required' },
        { status: 400 }
      );
    }

    const service = getPushPullService();
    const success = await service.deletePreference(userId, id);

    if (!success) {
      return NextResponse.json(
        { error: 'Preference not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/pushpull/preferences/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete preference' },
      { status: 500 }
    );
  }
}
