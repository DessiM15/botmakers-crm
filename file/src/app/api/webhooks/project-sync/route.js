import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { projects, projectMilestones, activityLog } from '@/lib/db/schema';
import { eq, and, ilike } from 'drizzle-orm';

export async function POST(request) {
  try {
    const body = await request.json();
    const { projectId, apiKey, milestones } = body;

    if (!projectId || !apiKey) {
      return NextResponse.json({ error: 'projectId and apiKey are required' }, { status: 400 });
    }

    if (!Array.isArray(milestones) || milestones.length === 0) {
      return NextResponse.json({ error: 'milestones array is required' }, { status: 400 });
    }

    // Verify project and API key
    const [project] = await db
      .select({ id: projects.id, syncApiKey: projects.syncApiKey })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.syncApiKey || project.syncApiKey !== apiKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    let updated = 0;

    for (const ms of milestones) {
      if (!ms.title || !ms.status) continue;

      // Find milestone by title (case-insensitive)
      const [milestone] = await db
        .select()
        .from(projectMilestones)
        .where(
          and(
            eq(projectMilestones.projectId, projectId),
            ilike(projectMilestones.title, ms.title)
          )
        )
        .limit(1);

      if (!milestone) continue;

      const validStatuses = ['pending', 'in_progress', 'completed'];
      if (!validStatuses.includes(ms.status)) continue;

      if (milestone.status !== ms.status) {
        const updateData = {
          status: ms.status,
          updatedAt: new Date(),
        };
        if (ms.status === 'completed') {
          updateData.completedAt = new Date();
        } else {
          updateData.completedAt = null;
        }

        await db
          .update(projectMilestones)
          .set(updateData)
          .where(eq(projectMilestones.id, milestone.id));

        await db.insert(activityLog).values({
          actorId: null,
          actorType: 'system',
          action: `milestone.sync_${ms.status}`,
          entityType: 'project',
          entityId: projectId,
          metadata: {
            milestoneId: milestone.id,
            milestoneTitle: milestone.title,
            fromStatus: milestone.status,
            toStatus: ms.status,
            trigger: 'project_sync_webhook',
          },
        });

        updated++;
      }
    }

    return NextResponse.json({
      message: 'Sync processed',
      updated,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Sync processing failed' }, { status: 500 });
  }
}
