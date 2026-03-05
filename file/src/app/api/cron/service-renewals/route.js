import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { clientServices, activityLog } from '@/lib/db/schema';
import { eq, and, lte, gte, or } from 'drizzle-orm';
import { getUpcomingRenewals } from '@/lib/db/queries/services';
import { serviceRenewalAlert } from '@/lib/email/notifications';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find services with renewal within 7 days that are still "active"
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + 7);

    const activeNearRenewal = await db
      .select()
      .from(clientServices)
      .where(
        and(
          eq(clientServices.status, 'active'),
          lte(clientServices.renewalDate, future.toISOString().split('T')[0]),
          gte(clientServices.renewalDate, now.toISOString().split('T')[0])
        )
      );

    // Update status to expiring_soon
    let updated = 0;
    for (const svc of activeNearRenewal) {
      await db
        .update(clientServices)
        .set({ status: 'expiring_soon', updatedAt: new Date() })
        .where(eq(clientServices.id, svc.id));
      updated++;
    }

    // Get all upcoming renewals for notification
    const renewals = await getUpcomingRenewals(7);

    if (renewals.length > 0) {
      await serviceRenewalAlert(renewals);

      await db.insert(activityLog).values({
        actorId: null,
        actorType: 'system',
        action: 'cron.service_renewals',
        entityType: 'system',
        entityId: '00000000-0000-0000-0000-000000000000',
        metadata: { renewalCount: renewals.length, statusUpdated: updated },
      });
    }

    return NextResponse.json({
      message: 'Service renewals processed',
      statusUpdated: updated,
      renewalAlerts: renewals.length,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Cron processing failed' }, { status: 500 });
  }
}
