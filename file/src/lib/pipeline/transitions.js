import { db } from '@/lib/db/client';
import { leads, activityLog, followUpReminders } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { leadStageChange } from '@/lib/email/notifications';
import { revalidatePath } from 'next/cache';

/**
 * Pipeline stages in order. Index determines forward/backward.
 */
export const PIPELINE_STAGE_ORDER = [
  'new_lead',
  'contacted',
  'discovery_scheduled',
  'discovery_completed',
  'proposal_sent',
  'negotiation',
  'contract_signed',
  'active_client',
  'project_delivered',
  'retention',
];

/**
 * Follow-up reminder rules: stage → { delayDays, reason }
 */
const FOLLOW_UP_RULES = {
  contacted: { delayDays: 3, reason: 'Follow up after initial contact' },
  discovery_scheduled: { delayDays: 2, reason: 'Follow up after discovery call' },
  proposal_sent: { delayDays: 2, reason: 'Follow up on proposal' },
  negotiation: { delayDays: 1, reason: 'Follow up on negotiation' },
};

/**
 * Advance a lead's pipeline stage automatically.
 *
 * Rules:
 * - Only moves FORWARD (higher index) — never backward
 * - Skips if lead is already at or past the target stage
 * - Logs to activity_log with trigger reason
 * - Sends team notification (non-blocking)
 * - Schedules follow-up reminder if stage has a rule
 *
 * @param {string} leadId - UUID of the lead
 * @param {string} newStage - Target pipeline stage
 * @param {string} trigger - Description of what triggered this transition
 * @returns {{ from: string, to: string } | null} - null if no transition happened
 */
export async function advanceLead(leadId, newStage, trigger) {
  try {
    const [lead] = await db
      .select({
        id: leads.id,
        fullName: leads.fullName,
        email: leads.email,
        pipelineStage: leads.pipelineStage,
        assignedTo: leads.assignedTo,
      })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) return null;

    const currentStage = lead.pipelineStage;
    const currentIndex = PIPELINE_STAGE_ORDER.indexOf(currentStage);
    const newIndex = PIPELINE_STAGE_ORDER.indexOf(newStage);

    // Only advance forward — never backward
    if (newIndex <= currentIndex) return null;

    const now = new Date();

    // Update lead stage
    const updateData = {
      pipelineStage: newStage,
      pipelineStageChangedAt: now,
      updatedAt: now,
    };

    // Also set lastContactedAt if moving to contacted
    if (newStage === 'contacted') {
      updateData.lastContactedAt = now;
    }

    await db.update(leads).set(updateData).where(eq(leads.id, leadId));

    // Log to activity_log (system-triggered)
    await db.insert(activityLog).values({
      actorType: 'system',
      action: 'lead.auto_stage_changed',
      entityType: 'lead',
      entityId: leadId,
      metadata: { from: currentStage, to: newStage, trigger },
    });

    // Send team notification (non-blocking)
    leadStageChange(lead, currentStage, newStage).catch(() => {});

    // Revalidate relevant paths
    revalidatePath('/pipeline');
    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/');

    // Schedule follow-up reminder if stage has a rule
    const rule = FOLLOW_UP_RULES[newStage];
    if (rule) {
      try {
        // Dismiss any existing pending reminders for this lead
        await db
          .update(followUpReminders)
          .set({ status: 'dismissed' })
          .where(
            and(
              eq(followUpReminders.leadId, leadId),
              eq(followUpReminders.status, 'pending')
            )
          );

        // Create new reminder
        const remindAt = new Date();
        remindAt.setDate(remindAt.getDate() + rule.delayDays);

        await db.insert(followUpReminders).values({
          leadId,
          assignedTo: lead.assignedTo || null,
          remindAt,
          triggerReason: rule.reason,
        });
      } catch {
        // Follow-up scheduling should never break the pipeline transition
      }
    }

    return { from: currentStage, to: newStage };
  } catch {
    // Auto-transitions should never break the parent action
    return null;
  }
}
