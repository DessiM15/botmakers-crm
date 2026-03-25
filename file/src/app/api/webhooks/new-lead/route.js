import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { leads, inAppNotifications } from '@/lib/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { newLeadAlert } from '@/lib/email/notifications';
import { sendTeamNotification } from '@/lib/notifications/notify';

/**
 * Webhook for new lead notification.
 * Called by database trigger (pg_net) or external systems after inserting a lead.
 * Secured with CRON_SECRET in Authorization header.
 *
 * POST /api/webhooks/new-lead
 * Body: { leadId: "uuid" }
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ error: 'Secret not configured' }, { status: 503 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    // Fetch full lead row
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Idempotency check: skip if we already notified about this lead in the last 60 seconds
    const recentCutoff = new Date(Date.now() - 60 * 1000);
    const [existing] = await db
      .select({ id: inAppNotifications.id })
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.type, 'new_lead'),
          eq(inAppNotifications.link, `/leads/${leadId}`),
          gt(inAppNotifications.createdAt, recentCutoff)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({
        ok: true,
        message: 'Already notified',
        leadId: lead.id,
      });
    }

    // Send email notification (non-blocking)
    newLeadAlert(lead).catch(() => {});

    // Send in-app notification to all team members
    sendTeamNotification({
      type: 'new_lead',
      title: `New lead: ${lead.fullName}`,
      body: lead.companyName
        ? `${lead.fullName} from ${lead.companyName} (${lead.source?.replace(/_/g, ' ')})`
        : `${lead.fullName} (${lead.source?.replace(/_/g, ' ')})`,
      link: `/leads/${lead.id}`,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      message: 'Notifications sent',
      leadId: lead.id,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
