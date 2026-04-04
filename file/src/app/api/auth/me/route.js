import { NextResponse } from 'next/server';
import { getTeamUser } from '@/lib/auth/helpers';
import { getStorageClient } from '@/lib/db/client';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/me
 * Returns the current team user's ID, name, and avatar URL.
 * Used by MasterLayout header and RealtimeNotificationProvider.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const result = await getTeamUser(cookieStore);

    if (!result) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let avatarUrl = null;
    if (result.teamUser.avatarUrl) {
      const storage = getStorageClient();
      const { data: signed } = await storage.createSignedUrl(
        result.teamUser.avatarUrl,
        86400
      );
      avatarUrl = signed?.signedUrl || null;
    }

    return NextResponse.json({
      id: result.teamUser.id,
      fullName: result.teamUser.fullName,
      role: result.teamUser.role,
      avatarUrl,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
