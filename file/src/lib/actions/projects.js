'use server';

import { db } from '@/lib/db/client';
import {
  projects,
  projectPhases,
  projectMilestones,
  activityLog,
  clients,
  leads,
} from '@/lib/db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { projectCreateSchema, milestoneUpdateSchema } from '@/lib/utils/validators';
import { milestoneCompletedEmail, projectCompletedEmail } from '@/lib/email/notifications';
import { sendTeamNotification } from '@/lib/notifications/notify';
import { advanceLead } from '@/lib/pipeline/transitions';

/**
 * Create a new project with phases and milestones.
 */
export async function createProject(formData, phasesData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = projectCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: 'CB-API-001: ' + parsed.error.issues[0].message };
    }

    const data = parsed.data;

    // Insert project
    const [project] = await db
      .insert(projects)
      .values({
        name: data.name,
        clientId: data.clientId,
        proposalId: data.proposalId || null,
        leadId: data.leadId || null,
        projectType: data.projectType || null,
        description: data.description || null,
        pricingType: data.pricingType,
        totalValue: String(data.totalValue),
        startDate: data.startDate || null,
        targetEndDate: data.targetEndDate || null,
        createdBy: teamUser.id,
      })
      .returning();

    // Insert phases and milestones
    if (phasesData && phasesData.length > 0) {
      for (const phase of phasesData) {
        const [newPhase] = await db
          .insert(projectPhases)
          .values({
            projectId: project.id,
            name: phase.name,
            sortOrder: phase.sortOrder,
          })
          .returning();

        if (phase.milestones && phase.milestones.length > 0) {
          const milestoneValues = phase.milestones.map((m, i) => ({
            projectId: project.id,
            phaseId: newPhase.id,
            title: typeof m === 'string' ? m : m.title,
            sortOrder: i,
          }));

          await db.insert(projectMilestones).values(milestoneValues);
        }
      }
    }

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
      metadata: { name: project.name, clientId: data.clientId },
    });

    revalidatePath('/projects');
    revalidatePath('/clients');

    return { success: true, projectId: project.id };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to create project' };
  }
}

/**
 * Update project info.
 */
export async function updateProject(projectId, formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!existing) {
      return { error: 'CB-DB-002: Project not found' };
    }

    const updateData = { updatedAt: new Date() };
    if (formData.name !== undefined) updateData.name = formData.name;
    if (formData.projectType !== undefined) updateData.projectType = formData.projectType || null;
    if (formData.description !== undefined) updateData.description = formData.description || null;
    if (formData.pricingType !== undefined) updateData.pricingType = formData.pricingType;
    if (formData.totalValue !== undefined) updateData.totalValue = String(formData.totalValue);
    if (formData.startDate !== undefined) updateData.startDate = formData.startDate || null;
    if (formData.targetEndDate !== undefined) updateData.targetEndDate = formData.targetEndDate || null;

    await db.update(projects).set(updateData).where(eq(projects.id, projectId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'project.updated',
      entityType: 'project',
      entityId: projectId,
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/projects');

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to update project' };
  }
}

/**
 * Update project status.
 * When completing: auto-completes all milestones, updates linked lead, sends client email.
 */
export async function updateProjectStatus(projectId, status) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const updateData = { status, updatedAt: new Date() };

    // If completing, set actual end date
    if (status === 'completed') {
      updateData.actualEndDate = new Date().toISOString().split('T')[0];
    }

    await db.update(projects).set(updateData).where(eq(projects.id, projectId));

    // If completing, auto-complete all remaining milestones
    if (status === 'completed') {
      await db
        .update(projectMilestones)
        .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(projectMilestones.projectId, projectId),
            ne(projectMilestones.status, 'completed')
          )
        );

      // Update linked lead to project_delivered
      const [proj] = await db
        .select({ leadId: projects.leadId, clientId: projects.clientId, name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (proj?.leadId) {
        await db
          .update(leads)
          .set({
            pipelineStage: 'project_delivered',
            pipelineStageChangedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(leads.id, proj.leadId));

        revalidatePath('/pipeline');
      }

      // Send client email (non-blocking)
      if (proj?.clientId) {
        const [client] = await db
          .select({ email: clients.email, fullName: clients.fullName })
          .from(clients)
          .where(eq(clients.id, proj.clientId))
          .limit(1);
        if (client) {
          projectCompletedEmail(client.email, client.fullName, proj.name).catch(() => {});
        }
      }
    }

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: status === 'completed' ? 'project.completed' : 'project.status_changed',
      entityType: 'project',
      entityId: projectId,
      metadata: { status },
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/projects');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to update project status' };
  }
}

/**
 * Create a new phase for a project.
 */
export async function createPhase(projectId, name) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    // Get max sort order
    const [maxResult] = await db
      .select({ maxOrder: sql`COALESCE(MAX(sort_order), 0)` })
      .from(projectPhases)
      .where(eq(projectPhases.projectId, projectId));

    const [phase] = await db
      .insert(projectPhases)
      .values({
        projectId,
        name,
        sortOrder: Number(maxResult.maxOrder) + 1,
      })
      .returning();

    revalidatePath(`/projects/${projectId}`);

    return { success: true, phase };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to create phase' };
  }
}

/**
 * Delete a phase and its milestones.
 */
export async function deletePhase(phaseId, projectId) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    await db.delete(projectPhases).where(eq(projectPhases.id, phaseId));

    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to delete phase' };
  }
}

/**
 * Create a new milestone.
 */
export async function createMilestone(phaseId, projectId, data) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    // Get max sort order
    const [maxResult] = await db
      .select({ maxOrder: sql`COALESCE(MAX(sort_order), 0)` })
      .from(projectMilestones)
      .where(eq(projectMilestones.phaseId, phaseId));

    const [milestone] = await db
      .insert(projectMilestones)
      .values({
        projectId,
        phaseId,
        title: data.title,
        description: data.description || null,
        sortOrder: Number(maxResult.maxOrder) + 1,
        dueDate: data.dueDate || null,
        triggersInvoice: data.triggersInvoice || false,
        invoiceAmount: data.invoiceAmount ? String(data.invoiceAmount) : null,
      })
      .returning();

    revalidatePath(`/projects/${projectId}`);

    return { success: true, milestone };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to create milestone' };
  }
}

/**
 * Update a milestone (status, due_date, triggers_invoice, etc.)
 */
export async function updateMilestone(milestoneId, data) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    // Get current milestone to find projectId
    const [milestone] = await db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.id, milestoneId))
      .limit(1);

    if (!milestone) {
      return { error: 'CB-DB-002: Milestone not found' };
    }

    const updateData = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate || null;
    if (data.triggersInvoice !== undefined) updateData.triggersInvoice = data.triggersInvoice;
    if (data.invoiceAmount !== undefined) updateData.invoiceAmount = data.invoiceAmount ? String(data.invoiceAmount) : null;

    // If completing, set completed_at
    if (data.status === 'completed' && milestone.status !== 'completed') {
      updateData.completedAt = new Date();
    }

    // If un-completing, clear completed_at
    if (data.status && data.status !== 'completed') {
      updateData.completedAt = null;
    }

    await db
      .update(projectMilestones)
      .set(updateData)
      .where(eq(projectMilestones.id, milestoneId));

    // Auto-transition: first milestone in-progress → active_client
    if (data.status === 'in_progress' && milestone.status !== 'in_progress') {
      const [proj] = await db
        .select({ leadId: projects.leadId })
        .from(projects)
        .where(eq(projects.id, milestone.projectId))
        .limit(1);
      if (proj?.leadId) {
        await advanceLead(proj.leadId, 'active_client', 'first_milestone_started');
      }
    }

    // Log milestone completion and auto-create invoice if triggers_invoice
    if (data.status === 'completed' && milestone.status !== 'completed') {
      await db.insert(activityLog).values({
        actorId: teamUser.id,
        actorType: 'team',
        action: 'milestone.completed',
        entityType: 'project',
        entityId: milestone.projectId,
        metadata: { milestoneId, title: milestone.title },
      });

      // Notify client about milestone completion (non-blocking)
      const [proj] = await db
        .select({ id: projects.id, clientId: projects.clientId, name: projects.name })
        .from(projects)
        .where(eq(projects.id, milestone.projectId))
        .limit(1);

      if (proj?.clientId) {
        const [client] = await db
          .select({ email: clients.email, fullName: clients.fullName })
          .from(clients)
          .where(eq(clients.id, proj.clientId))
          .limit(1);
        if (client) {
          milestoneCompletedEmail(client.email, client.fullName, proj.name, milestone.title).catch(() => {});
        }

        // In-app notification to team
        sendTeamNotification({
          type: 'milestone_completed',
          title: `Milestone completed: ${milestone.title}`,
          body: `"${milestone.title}" in project "${proj.name}" has been completed.`,
          link: `/projects/${milestone.projectId}`,
          excludeUserId: teamUser.id,
        }).catch(() => {});

        // Auto-create invoice if milestone triggers one (WF-7)
        if (milestone.triggersInvoice) {
          const { createInvoiceFromMilestone } = await import('@/lib/actions/invoices');
          await createInvoiceFromMilestone(milestone, proj, teamUser.id);
        }
      }
    }

    // Update project updatedAt
    await db
      .update(projects)
      .set({ updatedAt: new Date() })
      .where(eq(projects.id, milestone.projectId));

    revalidatePath(`/projects/${milestone.projectId}`);
    revalidatePath('/projects');

    return { success: true, projectId: milestone.projectId };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to update milestone' };
  }
}

/**
 * Delete a milestone.
 */
export async function deleteMilestone(milestoneId, projectId) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    await db
      .delete(projectMilestones)
      .where(eq(projectMilestones.id, milestoneId));

    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to delete milestone' };
  }
}
