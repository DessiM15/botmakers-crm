import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { leads, activityLog, systemSettings } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { staleLeadAlert } from '@/lib/email/notifications';

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

    // Get stale threshold from system_settings (default 7 days)
    let staleDays = 7;
    try {
      const [setting] = await db
        .select({ value: systemSettings.value })
        .from(systemSettings)
        .where(sql`${systemSettings.key} = 'stale_lead_days'`)
        .limit(1);
      if (setting?.value) {
        staleDays = Number(setting.value) || 7;
      }
    } catch {
      // Use default
    }

    // Query stale leads
    const staleLeads = await db.execute(sql`
      SELECT id, full_name, email, pipeline_stage, last_contacted_at, assigned_to
      FROM leads
      WHERE pipeline_stage NOT IN ('contract_signed', 'active_client', 'project_delivered', 'retention')
        AND converted_to_client_id IS NULL
        AND (
          last_contacted_at IS NULL
          OR last_contacted_at < NOW() - INTERVAL '1 day' * ${staleDays}
        )
      ORDER BY last_contacted_at ASC NULLS FIRST
      LIMIT 50
    `);

    const staleList = staleLeads.rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      pipelineStage: r.pipeline_stage,
      lastContactedAt: r.last_contacted_at,
      assignedTo: r.assigned_to,
    }));

    if (staleList.length === 0) {
      return NextResponse.json({ ok: true, message: 'No stale leads', count: 0 });
    }

    // Send notification
    await staleLeadAlert(staleList);

    // Log activity
    await db.insert(activityLog).values({
      actorType: 'system',
      action: 'lead.stale_detected',
      entityType: 'lead',
      entityId: staleList[0].id,
      metadata: { count: staleList.length, staleDays },
    });

    return NextResponse.json({
      ok: true,
      message: `Found ${staleList.length} stale leads`,
      count: staleList.length,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
