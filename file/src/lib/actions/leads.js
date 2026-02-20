'use server';

import { db } from '@/lib/db/client';
import { leads, contacts, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { contactLogSchema } from '@/lib/utils/validators';
import { leadStageChange } from '@/lib/email/notifications';
import { advanceLead } from '@/lib/pipeline/transitions';
import { sendTeamNotification } from '@/lib/notifications/notify';

/**
 * Update a lead's pipeline stage.
 * - Updates pipeline_stage and pipeline_stage_changed_at
 * - If new stage is 'contacted', also updates last_contacted_at
 * - Logs to activity_log
 */
export async function updateLeadStage(leadId, newStage) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    // Get current stage for logging
    const [current] = await db
      .select({ pipelineStage: leads.pipelineStage })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!current) {
      return { error: 'CB-DB-002: Lead not found' };
    }

    const oldStage = current.pipelineStage;
    const now = new Date();

    const updateData = {
      pipelineStage: newStage,
      pipelineStageChangedAt: now,
      updatedAt: now,
    };

    if (newStage === 'contacted') {
      updateData.lastContactedAt = now;
    }

    await db.update(leads).set(updateData).where(eq(leads.id, leadId));

    // Log to activity_log
    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'lead.stage_changed',
      entityType: 'lead',
      entityId: leadId,
      metadata: { from: oldStage, to: newStage },
    });

    revalidatePath('/pipeline');
    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/');

    // Send notification (non-blocking)
    const [lead] = await db
      .select({ id: leads.id, fullName: leads.fullName, email: leads.email })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    if (lead) {
      leadStageChange(lead, oldStage, newStage).catch(() => {});
      sendTeamNotification({
        type: 'pipeline_move',
        title: `${lead.fullName} moved to ${newStage.replace(/_/g, ' ')}`,
        body: `Pipeline: ${oldStage.replace(/_/g, ' ')} → ${newStage.replace(/_/g, ' ')}`,
        link: `/leads/${leadId}`,
        excludeUserId: teamUser.id,
      }).catch(() => {});
    }

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to update lead stage' };
  }
}

/**
 * Update a lead's notes (auto-save on blur).
 */
export async function updateLeadNotes(leadId, notes) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [current] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!current) {
      return { error: 'CB-DB-002: Lead not found' };
    }

    await db
      .update(leads)
      .set({ notes, updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'lead.notes_updated',
      entityType: 'lead',
      entityId: leadId,
    });

    revalidatePath(`/leads/${leadId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to update notes' };
  }
}

/**
 * Update lead assignment (assigned_to).
 */
export async function updateLeadAssignment(leadId, teamUserId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [current] = await db
      .select({ id: leads.id, assignedTo: leads.assignedTo })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!current) {
      return { error: 'CB-DB-002: Lead not found' };
    }

    const assignTo = teamUserId === 'unassigned' ? null : teamUserId;

    await db
      .update(leads)
      .set({ assignedTo: assignTo, updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'lead.assigned',
      entityType: 'lead',
      entityId: leadId,
      metadata: { from: current.assignedTo, to: assignTo },
    });

    // Auto-transition: first assignment → contacted
    if (!current.assignedTo && assignTo) {
      await advanceLead(leadId, 'contacted', 'lead_assigned');
    }

    revalidatePath('/pipeline');
    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to update assignment' };
  }
}

/**
 * Log a contact/touchpoint for a lead.
 */
export async function createContact(formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = contactLogSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: 'CB-API-001: ' + parsed.error.issues[0].message };
    }

    const data = parsed.data;

    // Verify lead exists
    if (data.leadId) {
      const [lead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.id, data.leadId))
        .limit(1);

      if (!lead) {
        return { error: 'CB-DB-002: Lead not found' };
      }
    }

    const [inserted] = await db
      .insert(contacts)
      .values({
        leadId: data.leadId || null,
        clientId: data.clientId || null,
        type: data.type,
        subject: data.subject || null,
        body: data.body || null,
        direction: data.direction,
        createdBy: teamUser.id,
      })
      .returning();

    // Update last_contacted_at on the lead
    if (data.leadId) {
      await db
        .update(leads)
        .set({ lastContactedAt: new Date(), updatedAt: new Date() })
        .where(eq(leads.id, data.leadId));

      await db.insert(activityLog).values({
        actorId: teamUser.id,
        actorType: 'team',
        action: 'contact.created',
        entityType: 'lead',
        entityId: data.leadId,
        metadata: { contactType: data.type, direction: data.direction },
      });

      revalidatePath(`/leads/${data.leadId}`);

      // Auto-transition: first contact/note → discovery_scheduled
      // Only if currently new_lead or contacted
      const [currentLead] = await db
        .select({ pipelineStage: leads.pipelineStage })
        .from(leads)
        .where(eq(leads.id, data.leadId))
        .limit(1);
      if (currentLead && (currentLead.pipelineStage === 'new_lead' || currentLead.pipelineStage === 'contacted')) {
        await advanceLead(data.leadId, 'discovery_scheduled', 'first_contact_logged');
      }
    }

    revalidatePath('/leads');
    revalidatePath('/pipeline');

    return { success: true, contact: inserted };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to log contact' };
  }
}
