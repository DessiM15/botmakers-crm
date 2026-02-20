'use server';

import { db } from '@/lib/db/client';
import { followUpReminders, leads, activityLog } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/client';
import { revalidatePath } from 'next/cache';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';

/**
 * Approve and send a follow-up reminder email.
 */
export async function approveAndSendFollowUp(reminderId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [reminder] = await db
      .select()
      .from(followUpReminders)
      .where(eq(followUpReminders.id, reminderId))
      .limit(1);

    if (!reminder) return { error: 'Reminder not found (CB-DB-002)' };
    if (reminder.status !== 'pending') return { error: 'Reminder is no longer pending' };
    if (!reminder.aiDraftSubject || !reminder.aiDraftBodyHtml) {
      return { error: 'No AI draft available. Please wait for draft generation.' };
    }

    // Get lead email
    const [lead] = await db
      .select({ email: leads.email, fullName: leads.fullName })
      .from(leads)
      .where(eq(leads.id, reminder.leadId))
      .limit(1);

    if (!lead) return { error: 'Lead not found (CB-DB-002)' };

    // Send email
    const result = await sendEmail({
      to: lead.email,
      subject: reminder.aiDraftSubject,
      html: reminder.aiDraftBodyHtml,
    });

    if (!result.success) {
      return { error: `Failed to send email (CB-INT-001): ${result.error}` };
    }

    // Update reminder status
    await db
      .update(followUpReminders)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(followUpReminders.id, reminderId));

    // Log activity
    await db.insert(activityLog).values({
      actorType: 'team',
      actorId: teamUser.id,
      action: 'follow_up.sent',
      entityType: 'lead',
      entityId: reminder.leadId,
      metadata: { reminderId, subject: reminder.aiDraftSubject },
    });

    // Update lead's lastContactedAt
    await db
      .update(leads)
      .set({ lastContactedAt: new Date(), updatedAt: new Date() })
      .where(eq(leads.id, reminder.leadId));

    revalidatePath('/');
    revalidatePath('/leads');
    revalidatePath(`/leads/${reminder.leadId}`);

    return { success: true };
  } catch (err) {
    return { error: 'Failed to send follow-up (CB-DB-001)' };
  }
}

/**
 * Dismiss a follow-up reminder.
 */
export async function dismissFollowUp(reminderId) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const [reminder] = await db
      .select({ id: followUpReminders.id, leadId: followUpReminders.leadId })
      .from(followUpReminders)
      .where(eq(followUpReminders.id, reminderId))
      .limit(1);

    if (!reminder) return { error: 'Reminder not found (CB-DB-002)' };

    await db
      .update(followUpReminders)
      .set({ status: 'dismissed' })
      .where(eq(followUpReminders.id, reminderId));

    revalidatePath('/');
    revalidatePath(`/leads/${reminder.leadId}`);

    return { success: true };
  } catch {
    return { error: 'Failed to dismiss follow-up (CB-DB-001)' };
  }
}
