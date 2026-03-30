'use server';

import { db } from '@/lib/db/client';
import { proposals, proposalLineItems, leads, activityLog, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email/client';
import { proposalSent, discoveryCallFollowUp } from '@/lib/email/templates';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { advanceLead } from '@/lib/pipeline/transitions';
import { sendTeamNotification } from '@/lib/notifications/notify';

/**
 * Send discovery call follow-up: create proposal, send it, and email the summary.
 * Called from DiscoveryCallSection after AI processing.
 */
export async function sendDiscoveryFollowUp({ leadId, summary, proposalData }) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    // Fetch lead
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return { error: 'CB-DB-002: Lead not found' };
    }

    // Calculate total from line items
    const lineItems = proposalData.suggested_line_items || [];
    const totalAmount = lineItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
      0
    );

    // Create proposal
    const [proposal] = await db
      .insert(proposals)
      .values({
        leadId,
        clientId: lead.convertedToClientId || null,
        title: proposalData.title,
        scopeOfWork: sanitizeHtml(proposalData.scope_of_work),
        deliverables: sanitizeHtml(proposalData.deliverables),
        termsAndConditions: sanitizeHtml(proposalData.terms_and_conditions),
        pricingType: proposalData.pricingType || 'fixed',
        totalAmount: String(totalAmount),
        aiGenerated: true,
        aiPromptContext: 'discovery_call_transcript',
        createdBy: teamUser.id,
      })
      .returning();

    // Insert line items
    if (lineItems.length > 0) {
      await db.insert(proposalLineItems).values(
        lineItems.map((item, idx) => ({
          proposalId: proposal.id,
          description: item.description,
          quantity: String(item.quantity || 1),
          unitPrice: String(item.unit_price || 0),
          total: String((Number(item.quantity) || 1) * (Number(item.unit_price) || 0)),
          sortOrder: idx,
          phaseLabel: item.phase_label || null,
        }))
      );
    }

    // Mark proposal as sent
    const now = new Date();
    await db
      .update(proposals)
      .set({ status: 'sent', sentAt: now, updatedAt: now })
      .where(eq(proposals.id, proposal.id));

    // Advance lead pipeline to discovery_completed
    await advanceLead(leadId, 'discovery_completed', 'discovery_call_processed');

    // Log activity
    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'discovery.follow_up_sent',
      entityType: 'lead',
      entityId: leadId,
      metadata: {
        proposalId: proposal.id,
        proposalTitle: proposal.title,
      },
    });

    // Team notification
    sendTeamNotification({
      type: 'proposal_sent',
      title: `Discovery follow-up sent: ${proposal.title}`,
      body: `Sent to ${lead.fullName} (${lead.email})`,
      link: `/proposals/${proposal.id}`,
      excludeUserId: teamUser.id,
    }).catch(() => {});

    // Send emails (non-blocking)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const portalUrl = `${appUrl}/portal/proposals/${proposal.id}`;

    // 1. Standard proposal sent email
    sendEmail({
      to: lead.email,
      subject: `New Proposal from Botmakers.ai: ${proposal.title}`,
      html: proposalSent(lead.fullName, proposal.title, portalUrl),
    }).catch(() => {});

    // 2. Discovery call follow-up email with highlights
    sendEmail({
      to: lead.email,
      subject: `Discovery Call Summary — ${lead.companyName || lead.fullName}`,
      html: discoveryCallFollowUp(lead.fullName, summary, proposal.title, portalUrl),
    }).catch(() => {});

    revalidatePath('/proposals');
    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/pipeline');

    return { success: true, proposalId: proposal.id };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to send discovery follow-up' };
  }
}
