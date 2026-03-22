/**
 * Pull Queue API
 * GET: List queued emails with pagination and filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPullQueueService, QueueQueryOptions } from '@/services/pushPull/pullQueueService';

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
 * GET /api/pushpull/queue
 * Query parameters:
 * - page: number (default 1)
 * - pageSize: number (default 20)
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 * - senderDomain: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const senderDomain = searchParams.get('senderDomain');

    const options: QueueQueryOptions = {
      userId,
      page,
      pageSize,
    };

    if (startDateStr) {
      options.startDate = new Date(startDateStr).getTime();
    }
    if (endDateStr) {
      options.endDate = new Date(endDateStr).getTime();
    }
    if (senderDomain) {
      options.sender = senderDomain;
    }

    const service = getPullQueueService();
    const result = await service.getQueuedEmails(options);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/pushpull/queue] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue' },
      { status: 500 }
    );
  }
}
