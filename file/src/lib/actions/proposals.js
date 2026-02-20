'use server';

import { db } from '@/lib/db/client';
import { proposals, proposalLineItems, leads, activityLog, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { proposalCreateSchema } from '@/lib/utils/validators';
import { sendEmail } from '@/lib/email/client';
import { proposalSent } from '@/lib/email/templates';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { advanceLead } from '@/lib/pipeline/transitions';

/**
 * Create a new proposal with line items.
 */
export async function createProposal(formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = proposalCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: 'CB-API-001: ' + parsed.error.issues[0].message };
    }

    const data = parsed.data;
    const lineItems = data.lineItems || [];

    const [proposal] = await db
      .insert(proposals)
      .values({
        leadId: data.leadId || null,
        clientId: data.clientId || null,
        title: data.title,
        scopeOfWork: sanitizeHtml(data.scopeOfWork),
        deliverables: sanitizeHtml(data.deliverables),
        termsAndConditions: sanitizeHtml(data.termsAndConditions),
        pricingType: data.pricingType,
        totalAmount: String(data.totalAmount),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        aiGenerated: formData.aiGenerated || false,
        aiPromptContext: formData.aiPromptContext || null,
        createdBy: teamUser.id,
      })
      .returning();

    if (lineItems.length > 0) {
      await db.insert(proposalLineItems).values(
        lineItems.map((item, idx) => ({
          proposalId: proposal.id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          total: String(item.total),
          sortOrder: item.sortOrder ?? idx,
          phaseLabel: item.phaseLabel || null,
        }))
      );
    }

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'proposal.created',
      entityType: 'proposal',
      entityId: proposal.id,
      metadata: { title: proposal.title },
    });

    // Auto-transition: proposal created → proposal_sent stage
    if (data.leadId) {
      await advanceLead(data.leadId, 'proposal_sent', 'proposal_created');
    }

    revalidatePath('/proposals');
    if (data.clientId) revalidatePath(`/clients/${data.clientId}`);

    return { success: true, proposal };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to create proposal' };
  }
}

/**
 * Update an existing proposal (draft only).
 */
export async function updateProposal(proposalId, formData) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const [existing] = await db
      .select({ id: proposals.id, status: proposals.status })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!existing) {
      return { error: 'CB-DB-002: Proposal not found' };
    }

    if (existing.status !== 'draft') {
      return { error: 'Only draft proposals can be edited' };
    }

    const parsed = proposalCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: 'CB-API-001: ' + parsed.error.issues[0].message };
    }

    const data = parsed.data;
    const lineItems = data.lineItems || [];

    await db
      .update(proposals)
      .set({
        leadId: data.leadId || null,
        clientId: data.clientId || null,
        title: data.title,
        scopeOfWork: sanitizeHtml(data.scopeOfWork),
        deliverables: sanitizeHtml(data.deliverables),
        termsAndConditions: sanitizeHtml(data.termsAndConditions),
        pricingType: data.pricingType,
        totalAmount: String(data.totalAmount),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalId));

    // Replace line items
    await db
      .delete(proposalLineItems)
      .where(eq(proposalLineItems.proposalId, proposalId));

    if (lineItems.length > 0) {
      await db.insert(proposalLineItems).values(
        lineItems.map((item, idx) => ({
          proposalId: proposalId,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          total: String(item.total),
          sortOrder: item.sortOrder ?? idx,
          phaseLabel: item.phaseLabel || null,
        }))
      );
    }

    revalidatePath('/proposals');
    revalidatePath(`/proposals/${proposalId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to update proposal' };
  }
}

/**
 * Send a proposal to the client/lead.
 * Updates status to 'sent', sends email, logs activity.
 */
export async function sendProposal(proposalId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      return { error: 'CB-DB-002: Proposal not found' };
    }

    if (proposal.status !== 'draft') {
      return { error: 'Only draft proposals can be sent' };
    }

    // Determine recipient email
    let recipientEmail = null;
    let recipientName = null;

    if (proposal.clientId) {
      const [client] = await db
        .select({ email: clients.email, fullName: clients.fullName })
        .from(clients)
        .where(eq(clients.id, proposal.clientId))
        .limit(1);
      if (client) {
        recipientEmail = client.email;
        recipientName = client.fullName;
      }
    }

    if (!recipientEmail && proposal.leadId) {
      const [lead] = await db
        .select({ email: leads.email, fullName: leads.fullName })
        .from(leads)
        .where(eq(leads.id, proposal.leadId))
        .limit(1);
      if (lead) {
        recipientEmail = lead.email;
        recipientName = lead.fullName;
      }
    }

    if (!recipientEmail) {
      return { error: 'No recipient email found. Link a client or lead first.' };
    }

    const now = new Date();
    await db
      .update(proposals)
      .set({
        status: 'sent',
        sentAt: now,
        updatedAt: now,
      })
      .where(eq(proposals.id, proposalId));

    // Update lead pipeline stage if linked
    if (proposal.leadId) {
      await db
        .update(leads)
        .set({
          pipelineStage: 'proposal_sent',
          pipelineStageChangedAt: now,
          updatedAt: now,
        })
        .where(eq(leads.id, proposal.leadId));
    }

    // Log activity
    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'proposal.sent',
      entityType: 'proposal',
      entityId: proposalId,
      metadata: {
        title: proposal.title,
        recipientEmail,
        recipientName,
      },
    });

    // Send email (don't block on failure)
    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/proposals/${proposalId}`;
    sendEmail({
      to: recipientEmail,
      subject: `New Proposal from Botmakers.ai: ${proposal.title}`,
      html: proposalSent(recipientName || 'there', proposal.title, portalUrl),
    }).catch(() => {});

    revalidatePath('/proposals');
    revalidatePath(`/proposals/${proposalId}`);
    if (proposal.leadId) {
      revalidatePath('/leads');
      revalidatePath(`/leads/${proposal.leadId}`);
      revalidatePath('/pipeline');
    }

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to send proposal' };
  }
}
