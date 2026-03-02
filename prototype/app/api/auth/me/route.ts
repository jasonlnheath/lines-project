import { NextRequest, NextResponse } from 'next/server';

/**
 * Get current authentication status
 */
export async function GET(request: NextRequest) {
  const tokens = request.cookies.get('auth_tokens')?.value;
  const userInfo = request.cookies.get('user_info')?.value;

  if (!tokens || !userInfo) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const tokenData = JSON.parse(tokens);
    const user = JSON.parse(userInfo);

    // Check if token is expired
    const isExpired = Date.now() >= tokenData.expiresAt - 300000; // 5 min buffer

    return NextResponse.json({
      authenticated: !isExpired,
      user: !isExpired ? user : null,
      expired: isExpired,
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false });
  }
}
