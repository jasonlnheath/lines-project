/**
 * Promote to Push API
 * POST: Promote emails from queue when sender preference changes to push
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPullQueueService } from '@/services/pushPull/pullQueueService';

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
 * POST /api/pushpull/queue/promote
 * Body: { senderEmail: string }
 * Removes all emails from queue for this sender (they now get push notifications)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { senderEmail } = body;

    if (!senderEmail) {
      return NextResponse.json(
        { error: 'senderEmail is required' },
        { status: 400 }
      );
    }

    const service = getPullQueueService();
    const removedCount = await service.promoteToPush(userId, senderEmail);

    return NextResponse.json({ removedCount });
  } catch (error) {
    console.error('[POST /api/pushpull/queue/promote] Error:', error);
    return NextResponse.json(
      { error: 'Failed to promote sender' },
      { status: 500 }
    );
  }
}
