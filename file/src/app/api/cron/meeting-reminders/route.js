import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { meetings, activityLog } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { sendTeamNotification } from '@/lib/notifications/notify';

export async function GET(request) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find meetings starting in the next 20 minutes that haven't had a reminder sent
    const upcoming = await db.execute(sql`
      SELECT id, title, start_time, attendee_name, attendee_email, metadata
      FROM meetings
      WHERE status = 'scheduled'
        AND start_time > NOW()
        AND start_time <= NOW() + INTERVAL '20 minutes'
      ORDER BY start_time ASC
      LIMIT 20
    `);

    let sentCount = 0;

    for (const row of upcoming.rows) {
      // Check if reminder already sent (stored in metadata jsonb)
      const meta = row.metadata || {};
      if (meta.reminderSent) continue;

      // Send in-app notification
      await sendTeamNotification({
        type: 'meeting_reminder',
        title: `Meeting in 15 min: ${row.title}`,
        body: row.attendee_name || row.attendee_email || '',
        link: '/calendar',
      });

      // Mark reminder as sent in metadata
      const updatedMeta = { ...meta, reminderSent: true };
      await db
        .update(meetings)
        .set({ metadata: updatedMeta, updatedAt: new Date() })
        .where(eq(meetings.id, row.id));

      sentCount++;
    }

    return NextResponse.json({
      ok: true,
      message: `Sent ${sentCount} meeting reminder${sentCount !== 1 ? 's' : ''}`,
      count: sentCount,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
