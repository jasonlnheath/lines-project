import { NextRequest, NextResponse } from 'next/server';

/**
 * Get current authentication status
 */
export async function GET(request: NextRequest) {
  const refreshData = request.cookies.get('refresh_data')?.value;
  const userInfo = request.cookies.get('user_info')?.value;

  console.log('/api/auth/me called');
  console.log('Has refresh_data:', !!refreshData);
  console.log('Has userInfo:', !!userInfo);
  console.log('All cookies:', request.cookies.getAll().map(c => c.name));

  if (!refreshData || !userInfo) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    // Next.js auto-decodes cookie values
    const data = JSON.parse(refreshData);
    const user = JSON.parse(userInfo);

    // Check if token is expired
    const isExpired = Date.now() >= data.expiresAt - 300000; // 5 min buffer

    console.log('Token expired:', isExpired);
    console.log('User:', user.email);

    return NextResponse.json({
      authenticated: !isExpired,
      user: !isExpired ? user : null,
      expired: isExpired,
    });
  } catch (error) {
    console.error('Error parsing auth data:', error);
    return NextResponse.json({ authenticated: false });
  }
}
