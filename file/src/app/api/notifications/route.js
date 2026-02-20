import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getTeamUser } from '@/lib/auth/helpers';
import {
  getUnreadNotifications,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/notifications/notify';

/**
 * GET /api/notifications — fetch unread notifications + count for the current team user.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await getTeamUser(cookieStore);
    if (!teamUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [notifications, count] = await Promise.all([
      getUnreadNotifications(teamUser.id, 10),
      getNotificationCount(teamUser.id),
    ]);

    return NextResponse.json({ notifications, count });
  } catch {
    return NextResponse.json({ notifications: [], count: 0 });
  }
}

/**
 * POST /api/notifications — mark notification(s) as read.
 * Body: { action: 'mark_read', notificationId: '...' } or { action: 'mark_all_read' }
 */
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await getTeamUser(cookieStore);
    if (!teamUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (body.action === 'mark_read' && body.notificationId) {
      await markNotificationRead(body.notificationId, teamUser.id);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'mark_all_read') {
      await markAllNotificationsRead(teamUser.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
