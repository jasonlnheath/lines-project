/**
 * Custom Trigger Rules API
 * GET: List custom trigger rules
 * POST: Add custom trigger rule
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
 * GET /api/pushpull/triggers
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const service = getPushTriggerService();
    const rules = await service.getCustomRules(userId);

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('[GET /api/pushpull/triggers] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trigger rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pushpull/triggers
 * Body: { name: string, type: 'sender' | 'subject' | 'body', pattern: string, caseInsensitive?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, pattern, caseInsensitive = true } = body;

    if (!name || !type || !pattern) {
      return NextResponse.json(
        { error: 'name, type, and pattern are required' },
        { status: 400 }
      );
    }

    if (!['sender', 'subject', 'body'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be "sender", "subject", or "body"' },
        { status: 400 }
      );
    }

    const service = getPushTriggerService();
    const rule = await service.addCustomRule(userId, name, type, pattern, caseInsensitive);

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('[POST /api/pushpull/triggers] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add trigger rule' },
      { status: 500 }
    );
  }
}
