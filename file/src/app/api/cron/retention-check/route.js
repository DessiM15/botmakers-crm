import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { leads, activityLog } from '@/lib/db/schema';
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

    // Find leads in 'project_delivered' where pipeline_stage_changed_at < now() - 3 days
    const result = await db.execute(sql`
      UPDATE leads
      SET pipeline_stage = 'retention',
          pipeline_stage_changed_at = NOW(),
          updated_at = NOW()
      WHERE pipeline_stage = 'project_delivered'
        AND pipeline_stage_changed_at < NOW() - INTERVAL '3 days'
      RETURNING id, full_name
    `);

    const moved = result.rows || [];

    // Log activity for each
    for (const lead of moved) {
      await db.insert(activityLog).values({
        actorType: 'system',
        action: 'lead.auto_stage_changed',
        entityType: 'lead',
        entityId: lead.id,
        metadata: {
          from: 'project_delivered',
          to: 'retention',
          trigger: 'auto_retention_3_days',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: moved.length > 0
        ? `Moved ${moved.length} lead(s) to retention`
        : 'No leads ready for retention',
      count: moved.length,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
