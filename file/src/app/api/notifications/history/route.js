import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getTeamUser } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { inAppNotifications } from '@/lib/db/schema';
import { eq, and, desc, count, inArray } from 'drizzle-orm';

const CATEGORY_TYPES = {
  leads: ['pipeline_move', 'lead_assigned', 'lead_stale', 'lead_stage_change', 'new_lead'],
  projects: ['project_created', 'project_completed', 'milestone_completed', 'milestone_overdue', 'demo_approved', 'demo_shared'],
  proposals: ['proposal_created', 'proposal_sent', 'proposal_viewed', 'proposal_signed'],
  invoices: ['invoice_created', 'invoice_sent', 'payment_received'],
  meetings: ['meeting_booked', 'meeting_created', 'meeting_rescheduled', 'meeting_cancelled', 'meeting_reminder', 'meeting_completed'],
  clients: ['client_created', 'client_question', 'follow_up_reminder'],
};

/**
 * GET /api/notifications/history — fetch ALL notifications (read + unread) for the current user.
 * Query params: page (default 1), filter (all|unread|read), category (all|leads|projects|proposals|invoices|meetings|clients)
 */
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await getTeamUser(cookieStore);
    if (!teamUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const perPage = 15;
    const filter = searchParams.get('filter') || 'all';
    const category = searchParams.get('category') || 'all';

    // Build conditions
    const conditions = [eq(inAppNotifications.userId, teamUser.id)];

    if (filter === 'unread') {
      conditions.push(eq(inAppNotifications.isRead, false));
    } else if (filter === 'read') {
      conditions.push(eq(inAppNotifications.isRead, true));
    }

    if (category !== 'all' && CATEGORY_TYPES[category]) {
      conditions.push(inArray(inAppNotifications.type, CATEGORY_TYPES[category]));
    }

    const where = and(...conditions);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(inAppNotifications)
      .where(where);

    // Get paginated results
    const notifications = await db
      .select()
      .from(inAppNotifications)
      .where(where)
      .orderBy(desc(inAppNotifications.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage);

    return NextResponse.json({
      notifications,
      total: Number(total),
      page,
      perPage,
      totalPages: Math.ceil(Number(total) / perPage),
    });
  } catch {
    return NextResponse.json({ notifications: [], total: 0, page: 1, perPage: 15, totalPages: 0 });
  }
}
