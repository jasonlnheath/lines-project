/**
 * Single VIP Sender API
 * DELETE: Remove a VIP sender
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
 * DELETE /api/pushpull/vip/[id]
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
        { error: 'VIP sender ID is required' },
        { status: 400 }
      );
    }

    const service = getPushPullService();
    const success = await service.removeVIPSender(userId, id);

    if (!success) {
      return NextResponse.json(
        { error: 'VIP sender not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/pushpull/vip/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete VIP sender' },
      { status: 500 }
    );
  }
}
