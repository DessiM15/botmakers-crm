import { db } from '@/lib/db/client';
import { followUpReminders, leads, teamUsers } from '@/lib/db/schema';
import { eq, and, desc, or, isNull } from 'drizzle-orm';

/**
 * Get pending follow-up reminders for the dashboard queue.
 * Shows reminders assigned to the given user, or unassigned ones.
 */
export async function getPendingFollowUps(teamUserId, limit = 10) {
  return db
    .select({
      id: followUpReminders.id,
      leadId: followUpReminders.leadId,
      remindAt: followUpReminders.remindAt,
      triggerReason: followUpReminders.triggerReason,
      aiDraftSubject: followUpReminders.aiDraftSubject,
      aiDraftBodyHtml: followUpReminders.aiDraftBodyHtml,
      aiDraftBodyText: followUpReminders.aiDraftBodyText,
      createdAt: followUpReminders.createdAt,
      leadName: leads.fullName,
      leadEmail: leads.email,
      leadCompany: leads.companyName,
      pipelineStage: leads.pipelineStage,
      assignedToName: teamUsers.fullName,
    })
    .from(followUpReminders)
    .innerJoin(leads, eq(followUpReminders.leadId, leads.id))
    .leftJoin(teamUsers, eq(followUpReminders.assignedTo, teamUsers.id))
    .where(
      and(
        eq(followUpReminders.status, 'pending'),
        or(
          eq(followUpReminders.assignedTo, teamUserId),
          isNull(followUpReminders.assignedTo)
        )
      )
    )
    .orderBy(desc(followUpReminders.remindAt))
    .limit(limit);
}

/**
 * Get follow-up reminders for a specific lead.
 */
export async function getLeadFollowUps(leadId) {
  return db
    .select({
      id: followUpReminders.id,
      remindAt: followUpReminders.remindAt,
      status: followUpReminders.status,
      triggerReason: followUpReminders.triggerReason,
      aiDraftSubject: followUpReminders.aiDraftSubject,
      sentAt: followUpReminders.sentAt,
      createdAt: followUpReminders.createdAt,
    })
    .from(followUpReminders)
    .where(eq(followUpReminders.leadId, leadId))
    .orderBy(desc(followUpReminders.createdAt))
    .limit(10);
}
