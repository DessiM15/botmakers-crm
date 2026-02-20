import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { followUpReminders, leads } from '@/lib/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { generateFollowUpEmail } from '@/lib/ai/client';

/**
 * GET /api/cron/follow-up-reminders
 *
 * Processes due follow-up reminders:
 * 1. Finds pending reminders where remind_at <= now
 * 2. Generates AI email drafts for those without one
 *
 * Protected by CRON_SECRET.
 */
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find pending reminders that are due
    const dueReminders = await db
      .select({
        id: followUpReminders.id,
        leadId: followUpReminders.leadId,
        triggerReason: followUpReminders.triggerReason,
        aiDraftSubject: followUpReminders.aiDraftSubject,
        leadName: leads.fullName,
        leadEmail: leads.email,
        company: leads.companyName,
        pipelineStage: leads.pipelineStage,
        lastContactedAt: leads.lastContactedAt,
      })
      .from(followUpReminders)
      .innerJoin(leads, eq(followUpReminders.leadId, leads.id))
      .where(
        and(
          eq(followUpReminders.status, 'pending'),
          lte(followUpReminders.remindAt, now)
        )
      )
      .limit(20);

    let drafted = 0;

    for (const reminder of dueReminders) {
      // Skip if already has a draft
      if (reminder.aiDraftSubject) continue;

      try {
        const draft = await generateFollowUpEmail({
          leadName: reminder.leadName,
          company: reminder.company,
          pipelineStage: reminder.pipelineStage,
          triggerReason: reminder.triggerReason,
          lastInteraction: reminder.lastContactedAt
            ? `Last contacted ${new Date(reminder.lastContactedAt).toLocaleDateString()}`
            : null,
        });

        await db
          .update(followUpReminders)
          .set({
            aiDraftSubject: draft.subject,
            aiDraftBodyHtml: draft.body_html,
            aiDraftBodyText: draft.body_text,
          })
          .where(eq(followUpReminders.id, reminder.id));

        drafted++;
      } catch {
        // Skip individual failures — don't block other reminders
      }
    }

    return NextResponse.json({
      success: true,
      due: dueReminders.length,
      drafted,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Cron job failed', detail: err.message },
      { status: 500 }
    );
  }
}
