import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getTeamUser } from '@/lib/auth/helpers';
import { getUserPreferences } from '@/lib/db/queries/notification-preferences';

/**
 * GET /api/notifications/preferences — fetch notification preferences for current user.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await getTeamUser(cookieStore);
    if (!teamUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preferences = await getUserPreferences(teamUser.id);
    return NextResponse.json({ preferences });
  } catch {
    return NextResponse.json({ preferences: {} });
  }
}
