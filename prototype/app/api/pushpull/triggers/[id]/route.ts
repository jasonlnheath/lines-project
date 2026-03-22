/**
 * Single Trigger Rule API
 * DELETE: Remove a trigger rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPushTriggerService } from '@/services/pushPull/pushTriggerService';

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
 * DELETE /api/pushpull/triggers/[id]
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
        { error: 'Trigger rule ID is required' },
        { status: 400 }
      );
    }

    const service = getPushTriggerService();
    const success = await service.removeCustomRule(userId, id);

    if (!success) {
      return NextResponse.json(
        { error: 'Trigger rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/pushpull/triggers/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete trigger rule' },
      { status: 500 }
    );
  }
}
