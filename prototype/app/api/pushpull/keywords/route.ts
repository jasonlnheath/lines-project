/**
 * Time-Sensitive Keywords API
 * GET: List keywords
 * POST: Add keyword
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
 * GET /api/pushpull/keywords
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const service = getPushPullService();
    const keywords = await service.getKeywords(userId);

    return NextResponse.json({ keywords });
  } catch (error) {
    console.error('[GET /api/pushpull/keywords] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pushpull/keywords
 * Body: { keyword: string, caseInsensitive?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { keyword, caseInsensitive = true } = body;

    if (!keyword) {
      return NextResponse.json(
        { error: 'keyword is required' },
        { status: 400 }
      );
    }

    const service = getPushPullService();
    const result = await service.addKeyword(userId, keyword, caseInsensitive);

    return NextResponse.json({ keyword: result });
  } catch (error) {
    console.error('[POST /api/pushpull/keywords] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add keyword' },
      { status: 500 }
    );
  }
}
