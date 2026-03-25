import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { meetings, activityLog } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

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

    // Find scheduled meetings whose end time is at least 1 hour ago
    const pastMeetings = await db.execute(sql`
      UPDATE meetings
      SET status = 'completed', updated_at = NOW()
      WHERE status = 'scheduled'
        AND end_time < NOW() - INTERVAL '1 hour'
      RETURNING id, title, project_id
    `);

    const completed = pastMeetings.rows;

    // Log activity for each
    for (const m of completed.slice(0, 20)) {
      await db.insert(activityLog).values({
        actorType: 'system',
        action: 'meeting.auto_completed',
        entityType: 'meeting',
        entityId: m.id,
        metadata: { title: m.title },
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Auto-completed ${completed.length} meeting${completed.length !== 1 ? 's' : ''}`,
      count: completed.length,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
