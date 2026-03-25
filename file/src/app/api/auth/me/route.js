import { NextResponse } from 'next/server';
import { getTeamUser } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/me
 * Returns the current team user's ID and name.
 * Used by RealtimeNotificationProvider to get the user ID for filtering.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const result = await getTeamUser(cookieStore);

    if (!result) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({
      id: result.teamUser.id,
      fullName: result.teamUser.fullName,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
