/**
 * VIP Senders API
 * GET: List VIP senders
 * POST: Add VIP sender
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
 * GET /api/pushpull/vip
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const service = getPushPullService();
    const vipSenders = await service.getVIPSenders(userId);

    return NextResponse.json({ vipSenders });
  } catch (error) {
    console.error('[GET /api/pushpull/vip] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch VIP senders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pushpull/vip
 * Body: { email: string, domain?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { email, domain } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    const service = getPushPullService();
    const vipSender = await service.addVIPSender(userId, email, domain);

    return NextResponse.json({ vipSender });
  } catch (error) {
    console.error('[POST /api/pushpull/vip] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add VIP sender' },
      { status: 500 }
    );
  }
}
