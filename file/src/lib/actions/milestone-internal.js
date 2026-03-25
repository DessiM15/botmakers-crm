/**
 * Shared milestone completion logic.
 * NOT a server action — callable from both server actions and route handlers.
 *
 * Handles all downstream effects:
 * 1. Activity log
 * 2. Client email (milestone completed)
 * 3. Team in-app notification
 * 4. Pipeline advance (lead → active_client)
 * 5. Auto-create invoice if triggersInvoice (WF-7)
 * 6. Phase auto-complete (if all milestones in phase done)
 * 7. Project auto-complete (if all milestones done)
 */

import { db } from '@/lib/db/client';
import {
  projects,
  projectMilestones,
  projectPhases,
  activityLog,
  clients,
  teamUsers,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { milestoneCompletedEmail, projectCompletedEmail } from '@/lib/email/notifications';
import { sendTeamNotification } from '@/lib/notifications/notify';
import { advanceLead } from '@/lib/pipeline/transitions';

/**
 * Get a fallback team user ID for system-initiated actions
 * that require a createdBy (e.g. invoice creation).
 */
async function getSystemActorId() {
  const [admin] = await db
    .select({ id: teamUsers.id })
    .from(teamUsers)
    .where(eq(teamUsers.isActive, true))
    .limit(1);
  return admin?.id || null;
}

/**
 * Handle all downstream effects when a milestone is completed.
 *
 * @param {object} milestone - full milestone row (id, projectId, phaseId, title, triggersInvoice, invoiceAmount)
 * @param {object} opts
 * @param {string|null} opts.actorId - team user UUID (null for system)
 * @param {string} opts.actorType - 'team' or 'system'
 * @param {string} opts.trigger - what caused this ('manual', 'commit_tag', 'sync_file')
 */
export async function completeMilestoneInternal(milestone, { actorId = null, actorType = 'system', trigger = 'manual' } = {}) {
  // 1. Activity log
  await db.insert(activityLog).values({
    actorId,
    actorType,
    action: actorType === 'system' ? 'milestone.auto_completed' : 'milestone.completed',
    entityType: 'project',
    entityId: milestone.projectId,
    metadata: { milestoneId: milestone.id, title: milestone.title, trigger },
  });

  // 2. Fetch project + client
  const [proj] = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      name: projects.name,
      leadId: projects.leadId,
    })
    .from(projects)
    .where(eq(projects.id, milestone.projectId))
    .limit(1);

  if (!proj) return;

  // 3. Client email (non-blocking)
  if (proj.clientId) {
    const [client] = await db
      .select({ email: clients.email, fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.id, proj.clientId))
      .limit(1);
    if (client) {
      milestoneCompletedEmail(client.email, client.fullName, proj.name, milestone.title).catch(() => {});
    }
  }

  // 4. Team in-app notification (non-blocking)
  sendTeamNotification({
    type: 'milestone_completed',
    title: `Milestone completed: ${milestone.title}`,
    body: `"${milestone.title}" in project "${proj.name}" has been completed.`,
    link: `/projects/${milestone.projectId}`,
    excludeUserId: actorId,
  }).catch(() => {});

  // 5. Pipeline advance
  if (proj.leadId) {
    advanceLead(proj.leadId, 'active_client', `milestone_completed:${milestone.title}`).catch(() => {});
  }

  // 6. Auto-create invoice if triggersInvoice (WF-7)
  if (milestone.triggersInvoice) {
    try {
      const invoiceActorId = actorId || (await getSystemActorId());
      if (invoiceActorId) {
        const { createInvoiceFromMilestone } = await import('@/lib/actions/invoices');
        await createInvoiceFromMilestone(milestone, proj, invoiceActorId);
      }
    } catch {
      // Non-critical
    }
  }

  // 7. Phase auto-complete
  await checkPhaseCompletion(milestone.phaseId);

  // 8. Project auto-complete (checks all milestones)
  await checkProjectCompletion(milestone.projectId, { actorId, actorType });
}

/**
 * Handle first milestone starting → advance lead to active_client.
 */
export async function handleMilestoneStarted(milestone) {
  try {
    const [proj] = await db
      .select({ leadId: projects.leadId })
      .from(projects)
      .where(eq(projects.id, milestone.projectId))
      .limit(1);
    if (proj?.leadId) {
      await advanceLead(proj.leadId, 'active_client', 'first_milestone_started');
    }
  } catch {
    // Non-critical
  }
}

/**
 * Check if all milestones in a phase are completed → set phase completedAt.
 * If not all done, clear completedAt (handles milestone reverts).
 */
async function checkPhaseCompletion(phaseId) {
  if (!phaseId) return;

  try {
    const milestones = await db
      .select({ status: projectMilestones.status })
      .from(projectMilestones)
      .where(eq(projectMilestones.phaseId, phaseId));

    if (milestones.length === 0) return;

    const allDone = milestones.every((m) => m.status === 'completed');

    await db
      .update(projectPhases)
      .set({ completedAt: allDone ? new Date() : null })
      .where(eq(projectPhases.id, phaseId));
  } catch {
    // Non-critical
  }
}

/**
 * Check if all milestones in a project are completed → auto-complete project.
 * Triggers: lead → project_delivered, client email, team notification.
 */
async function checkProjectCompletion(projectId, { actorId, actorType }) {
  try {
    const allMilestones = await db
      .select({ status: projectMilestones.status })
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId));

    if (allMilestones.length === 0) return;
    if (!allMilestones.every((m) => m.status === 'completed')) return;

    // Check current project status — don't re-complete
    const [proj] = await db
      .select({
        status: projects.status,
        leadId: projects.leadId,
        clientId: projects.clientId,
        name: projects.name,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!proj || proj.status === 'completed') return;

    // Auto-complete the project
    await db
      .update(projects)
      .set({
        status: 'completed',
        actualEndDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    // Activity log
    await db.insert(activityLog).values({
      actorId,
      actorType,
      action: 'project.auto_completed',
      entityType: 'project',
      entityId: projectId,
      metadata: { trigger: 'all_milestones_completed' },
    });

    // Advance lead to project_delivered
    if (proj.leadId) {
      advanceLead(proj.leadId, 'project_delivered', 'all_milestones_completed').catch(() => {});
    }

    // Client email (non-blocking)
    if (proj.clientId) {
      const [client] = await db
        .select({ email: clients.email, fullName: clients.fullName })
        .from(clients)
        .where(eq(clients.id, proj.clientId))
        .limit(1);
      if (client) {
        projectCompletedEmail(client.email, client.fullName, proj.name).catch(() => {});
      }
    }

    // Team notification
    sendTeamNotification({
      type: 'milestone_completed',
      title: `Project completed: ${proj.name}`,
      body: `All milestones in "${proj.name}" are done. Project auto-completed.`,
      link: `/projects/${projectId}`,
      excludeUserId: actorId,
    }).catch(() => {});
  } catch {
    // Non-critical — don't break the parent
  }
}
