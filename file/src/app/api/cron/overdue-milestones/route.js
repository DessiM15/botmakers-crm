import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { projectMilestones, activityLog } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { milestoneOverdue } from '@/lib/email/notifications';

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

    // Query milestones that are past due and not completed
    const overdue = await db.execute(sql`
      SELECT
        pm.id,
        pm.title,
        pm.due_date,
        pm.status,
        pm.project_id,
        p.name as project_name
      FROM project_milestones pm
      JOIN projects p ON p.id = pm.project_id
      WHERE pm.status NOT IN ('completed')
        AND pm.due_date IS NOT NULL
        AND pm.due_date < CURRENT_DATE
      ORDER BY pm.due_date ASC
      LIMIT 50
    `);

    const overdueList = overdue.rows.map((r) => ({
      id: r.id,
      title: r.title,
      dueDate: r.due_date,
      projectId: r.project_id,
      projectName: r.project_name,
    }));

    if (overdueList.length === 0) {
      return NextResponse.json({ ok: true, message: 'No overdue milestones', count: 0 });
    }

    // Update status to 'overdue' for those not already overdue
    const idsToUpdate = overdue.rows
      .filter((r) => r.status !== 'overdue')
      .map((r) => r.id);

    if (idsToUpdate.length > 0) {
      await db.execute(sql`
        UPDATE project_milestones
        SET status = 'overdue', updated_at = NOW()
        WHERE id = ANY(${idsToUpdate}::uuid[])
      `);
    }

    // Send notification
    await milestoneOverdue(overdueList);

    // Log activity for each
    for (const m of overdueList.slice(0, 10)) {
      await db.insert(activityLog).values({
        actorType: 'system',
        action: 'milestone.overdue_detected',
        entityType: 'project',
        entityId: m.projectId,
        metadata: { milestoneId: m.id, title: m.title },
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Found ${overdueList.length} overdue milestones, updated ${idsToUpdate.length}`,
      count: overdueList.length,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
