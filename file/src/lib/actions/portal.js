'use server';

import { db } from '@/lib/db/client';
import { createAdminClient } from '@/lib/db/client';
import { clients, proposals, projects, projectQuestions, activityLog, followUpReminders, invoices, invoiceLineItems, systemSettings } from '@/lib/db/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { requireClient } from '@/lib/auth/helpers';
import { proposalAccepted as proposalAcceptedNotif, clientQuestion as clientQuestionNotif } from '@/lib/email/notifications';
import { advanceLead } from '@/lib/pipeline/transitions';
import { sendTeamNotification } from '@/lib/notifications/notify';
import { sendEmail } from '@/lib/email/client';
import { wrapInBrandedTemplate } from '@/lib/email/branded-template';
import { revalidatePath } from 'next/cache';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _magicLinkLimiter;
function getMagicLinkLimiter() {
  if (!_magicLinkLimiter) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    _magicLinkLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 h'),
      prefix: 'ratelimit:magic-link',
    });
  }
  return _magicLinkLimiter;
}

/**
 * Send a magic link to a client email.
 * @param {string} email
 * @param {string} redirectTo - portal path to redirect after login (default: '/portal')
 */
export async function sendMagicLink(email, redirectTo = '/portal') {
  try {
    if (!email || !email.includes('@')) {
      return { error: 'Please enter a valid email address.' };
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Sanitize redirect — must be a portal path
    const safeRedirect = (redirectTo && redirectTo.startsWith('/portal'))
      ? redirectTo
      : '/portal';

    // Check rate limit
    const { success: withinLimit } = await getMagicLinkLimiter().limit(normalizedEmail);
    if (!withinLimit) {
      return { error: 'Too many login attempts. Please try again later.' };
    }

    // Validate email exists in clients table
    const [client] = await db
      .select({ id: clients.id, fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.email, normalizedEmail))
      .limit(1);

    if (!client) {
      return { error: 'No account found — contact info@botmakers.ai' };
    }

    // Generate magic link via admin API (instead of relying on Supabase email)
    const supabase = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(safeRedirect)}`,
      },
    });

    if (linkError) {
      return { error: 'Failed to generate login link. Please try again.' };
    }

    // Build the actual magic link URL from the token hash
    const tokenHash = linkData?.properties?.hashed_token;
    const magicLinkUrl = `${siteUrl}/auth/callback?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent(safeRedirect)}`;

    // Send branded email via Resend
    const bodyHtml = `<p style="margin:0 0 16px; color:#333;">Click the button below to securely log in to your BotMakers client portal. This link expires in 1 hour.</p>
    <p style="margin:0 0 16px; color:#333;">No password needed — just click and you're in.</p>`;

    const html = wrapInBrandedTemplate({
      recipientName: client.fullName,
      bodyHtml,
      senderName: 'The BotMakers Team',
      senderTitle: null,
      ctaUrl: magicLinkUrl,
      ctaText: 'Log In to Your Portal',
    });

    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: 'Your Portal Login Link',
      html,
    });

    if (!emailResult.success) {
      return { error: 'Failed to send login link. Please try again.' };
    }

    return { success: true };
  } catch {
    return { error: 'Something went wrong. Please try again.' };
  }
}

/**
 * Submit a question from the client portal.
 */
export async function submitQuestion(projectId, questionText) {
  try {
    const cookieStore = await cookies();
    const { client } = await requireClient(cookieStore);

    if (!questionText || questionText.trim().length < 10) {
      return { error: 'Question must be at least 10 characters.' };
    }

    const [question] = await db
      .insert(projectQuestions)
      .values({
        projectId,
        clientId: client.id,
        questionText: questionText.trim(),
      })
      .returning();

    // Log activity (non-blocking — RLS may block client-initiated inserts)
    db.insert(activityLog).values({
      actorId: client.id,
      actorType: 'client',
      action: 'question.created',
      entityType: 'project',
      entityId: projectId,
      metadata: { questionId: question.id },
    }).catch(() => {});

    // Notify team (non-blocking)
    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (project) {
      clientQuestionNotif(project, question, client.fullName).catch(() => {});
      sendTeamNotification({
        type: 'client_question',
        title: `New question from ${client.fullName}`,
        body: `Question about "${project.name}": ${question.questionText.slice(0, 100)}`,
        link: `/projects/${project.id}?tab=questions`,
      }).catch(() => {});
    }

    return { success: true, question };
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('submitQuestion error:', err);
    return { error: 'Failed to submit question. Please try again.' };
  }
}

/**
 * Track when a client views a proposal.
 * Sets viewedAt on first view, increments viewed_count on every view.
 * Sends team notification on first view only.
 */
export async function trackProposalView(proposalId) {
  try {
    const cookieStore = await cookies();
    const { client } = await requireClient(cookieStore);

    const [proposal] = await db
      .select({
        viewedAt: proposals.viewedAt,
        clientId: proposals.clientId,
        title: proposals.title,
        status: proposals.status,
      })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal || proposal.clientId !== client.id) return;

    const isFirstView = !proposal.viewedAt;

    // Always increment viewed_count; set viewedAt + status on first view only
    await db
      .update(proposals)
      .set({
        viewedAt: isFirstView ? new Date() : proposal.viewedAt,
        status: proposal.status === 'sent' ? 'viewed' : proposal.status,
        viewedCount: sql`COALESCE(viewed_count, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalId));

    // First view: send team notification + log activity
    if (isFirstView) {
      db.insert(activityLog).values({
        actorId: client.id,
        actorType: 'client',
        action: 'proposal.viewed',
        entityType: 'proposal',
        entityId: proposalId,
        metadata: { clientName: client.fullName, proposalTitle: proposal.title },
      }).catch(() => {});

      sendTeamNotification({
        type: 'proposal_viewed',
        title: `${client.fullName} viewed your proposal`,
        body: `${client.fullName} just viewed proposal: ${proposal.title}`,
        link: `/proposals/${proposalId}`,
      }).catch(() => {});
    }
  } catch {
    // Non-critical — don't fail the page
  }
}

/**
 * Accept and sign a proposal from the client portal.
 * Captures signer name, IP, timestamp for e-signature record.
 */
export async function acceptProposal(proposalId, signature) {
  try {
    const cookieStore = await cookies();
    const headersList = await headers();
    const { client } = await requireClient(cookieStore);

    if (!signature || signature.trim().length < 2) {
      return { error: 'Please type your full name as signature.' };
    }

    // Validate proposal belongs to client
    const [proposal] = await db
      .select({
        id: proposals.id,
        clientId: proposals.clientId,
        leadId: proposals.leadId,
        status: proposals.status,
        expiresAt: proposals.expiresAt,
        title: proposals.title,
        totalAmount: proposals.totalAmount,
        createdBy: proposals.createdBy,
      })
      .from(proposals)
      .where(and(eq(proposals.id, proposalId), eq(proposals.clientId, client.id)))
      .limit(1);

    if (!proposal) {
      return { error: 'Proposal not found.' };
    }

    if (proposal.status === 'accepted') {
      return { error: 'This proposal has already been accepted.' };
    }

    if (proposal.expiresAt && new Date(proposal.expiresAt) < new Date()) {
      return { error: 'This proposal has expired.' };
    }

    // Capture signer IP from headers
    const signerIp = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headersList.get('x-real-ip')
      || 'unknown';

    const now = new Date();

    // Update proposal with signature details
    await db
      .update(proposals)
      .set({
        status: 'accepted',
        acceptedAt: now,
        signedAt: now,
        signerName: signature.trim(),
        signerIp,
        clientSignature: signature.trim(),
        updatedAt: now,
      })
      .where(eq(proposals.id, proposalId));

    // Log activity (non-blocking — RLS may block client-initiated inserts)
    db.insert(activityLog).values({
      actorId: client.id,
      actorType: 'client',
      action: 'proposal.signed',
      entityType: 'proposal',
      entityId: proposalId,
      metadata: {
        clientName: client.fullName,
        proposalTitle: proposal.title,
        signerName: signature.trim(),
        signerIp,
      },
    }).catch(() => {});

    // Auto-transition: proposal accepted → contract_signed
    if (proposal.leadId) {
      await advanceLead(proposal.leadId, 'contract_signed', 'proposal_accepted');
    }

    // Notify team via email (non-blocking)
    proposalAcceptedNotif(proposal, client.fullName).catch(() => {});

    // Notify team via in-app notification (non-blocking)
    const formattedAmount = Number(proposal.totalAmount).toLocaleString('en-US', {
      style: 'currency', currency: 'USD',
    });
    sendTeamNotification({
      type: 'proposal_signed',
      title: `${client.fullName} signed proposal: ${proposal.title}`,
      body: `${client.fullName} signed proposal "${proposal.title}". Contract value: ${formattedAmount}`,
      link: `/proposals/${proposalId}`,
    }).catch(() => {});

    // Auto-send portal invite if not yet invited
    const [clientRecord] = await db
      .select({ portalInvitedAt: clients.portalInvitedAt })
      .from(clients)
      .where(eq(clients.id, client.id))
      .limit(1);

    if (clientRecord && !clientRecord.portalInvitedAt) {
      try {
        const { sendPortalInvite } = await import('@/lib/actions/clients');
        await sendPortalInvite(client.id);
      } catch {
        // Non-blocking — invite can be sent manually later
      }
    }

    // Auto-generate deposit invoice
    try {
      const depositResult = await createDepositInvoice(proposal, client);
      if (depositResult?.paymentUrl) {
        // Send acceptance + deposit email to client
        const depositAmount = Number(depositResult.depositAmount).toLocaleString('en-US', {
          style: 'currency', currency: 'USD',
        });
        const acceptBodyHtml = `<p style="margin:0 0 16px; color:#333;">Thank you for accepting the proposal: <strong style="color:#033457;">${proposal.title}</strong></p>
          <p style="margin:0 0 16px; color:#333;">To get started, we require a deposit of <strong style="color:#033457;">${depositAmount}</strong>. Once received, we'll kick off your project right away.</p>
          <p style="margin:0 0 16px; color:#333;">Click the button below to pay your deposit securely via Square.</p>`;
        sendEmail({
          to: client.email,
          subject: `Proposal Accepted — Deposit Invoice: ${proposal.title}`,
          html: wrapInBrandedTemplate({
            recipientName: client.fullName,
            bodyHtml: acceptBodyHtml,
            senderName: 'The BotMakers Team',
            senderTitle: null,
            ctaUrl: depositResult.paymentUrl,
            ctaText: `Pay Deposit (${depositAmount})`,
          }),
        }).catch(() => {});
      }
    } catch {
      // Non-blocking — deposit can be created manually
    }

    revalidatePath('/invoices');
    revalidatePath('/proposals');
    revalidatePath(`/proposals/${proposalId}`);

    return { success: true };
  } catch {
    return { error: 'Failed to accept proposal. Please try again.' };
  }
}

/**
 * Create a deposit invoice for an accepted proposal.
 * Reads deposit percentage from system_settings (default 60%).
 */
async function createDepositInvoice(proposal, client) {
  // Get configurable deposit percentage
  let depositPct = 60;
  try {
    const [setting] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'deposit_percentage'))
      .limit(1);
    if (setting?.value?.percentage) {
      depositPct = Number(setting.value.percentage);
    }
  } catch {
    // Use default
  }

  const totalAmount = Number(proposal.totalAmount) || 0;
  if (totalAmount <= 0) return null;

  const depositAmount = (totalAmount * depositPct / 100).toFixed(2);

  // Create invoice
  const [invoice] = await db
    .insert(invoices)
    .values({
      clientId: client.id,
      proposalId: proposal.id,
      title: `Deposit — ${proposal.title}`,
      description: `${depositPct}% deposit for proposal: ${proposal.title}`,
      amount: depositAmount,
      status: 'sent',
      sentAt: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdBy: proposal.createdBy || (await getFirstAdmin()),
    })
    .returning();

  // Add line item
  await db.insert(invoiceLineItems).values({
    invoiceId: invoice.id,
    description: `${depositPct}% Deposit — ${proposal.title}`,
    quantity: '1',
    unitPrice: depositAmount,
    total: depositAmount,
    sortOrder: 0,
  });

  // Log activity
  db.insert(activityLog).values({
    actorType: 'system',
    action: 'invoice.auto_created',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      depositPercentage: depositPct,
      amount: depositAmount,
    },
  }).catch(() => {});

  // Try to create Square payment link
  let paymentUrl = null;
  try {
    const { isSquareConfigured, createSquareCheckoutLink } = await import('@/lib/integrations/square');
    if (isSquareConfigured()) {
      const result = await createSquareCheckoutLink(invoice.title, depositAmount);
      if (result?.paymentUrl) {
        paymentUrl = result.paymentUrl;
        await db
          .update(invoices)
          .set({ squarePaymentUrl: paymentUrl, updatedAt: new Date() })
          .where(eq(invoices.id, invoice.id));
      }
    }
  } catch {
    // Non-blocking
  }

  // If no Square, use portal URL
  if (!paymentUrl) {
    paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/invoices/${invoice.id}`;
  }

  return { invoice, depositAmount, paymentUrl };
}

/**
 * Get the first admin team user ID (for system-generated records).
 */
async function getFirstAdmin() {
  const { teamUsers } = await import('@/lib/db/schema');
  const [admin] = await db
    .select({ id: teamUsers.id })
    .from(teamUsers)
    .where(eq(teamUsers.role, 'admin'))
    .limit(1);
  return admin?.id;
}

/**
 * Decline a proposal from the client portal.
 * Captures decline reason, sends notifications, creates follow-up reminder.
 */
export async function declineProposal(proposalId, reason) {
  try {
    const cookieStore = await cookies();
    const { client } = await requireClient(cookieStore);

    if (!reason || reason.trim().length < 10) {
      return { error: 'Please provide at least 10 characters of feedback.' };
    }

    // Validate proposal belongs to client
    const [proposal] = await db
      .select({
        id: proposals.id,
        clientId: proposals.clientId,
        leadId: proposals.leadId,
        status: proposals.status,
        title: proposals.title,
        createdBy: proposals.createdBy,
      })
      .from(proposals)
      .where(and(eq(proposals.id, proposalId), eq(proposals.clientId, client.id)))
      .limit(1);

    if (!proposal) {
      return { error: 'Proposal not found.' };
    }

    if (proposal.status === 'declined') {
      return { error: 'This proposal has already been declined.' };
    }

    if (proposal.status === 'accepted') {
      return { error: 'This proposal has already been accepted.' };
    }

    const now = new Date();

    // Update proposal
    await db
      .update(proposals)
      .set({
        status: 'declined',
        declinedAt: now,
        declineReason: reason.trim(),
        updatedAt: now,
      })
      .where(eq(proposals.id, proposalId));

    // Log activity
    db.insert(activityLog).values({
      actorId: client.id,
      actorType: 'client',
      action: 'proposal.declined',
      entityType: 'proposal',
      entityId: proposalId,
      metadata: {
        clientName: client.fullName,
        proposalTitle: proposal.title,
        reason: reason.trim().slice(0, 200),
      },
    }).catch(() => {});

    // Send "thank you for feedback" email to client
    const thankYouHtml = `<p style="margin:0 0 16px; color:#333;">Thank you for your feedback on our proposal: <strong style="color:#033457;">${proposal.title}</strong></p>
      <p style="margin:0 0 16px; color:#333;">We appreciate your time and would love to work with you in the future. If anything changes, don't hesitate to reach out.</p>
      <p style="margin:0 0 16px; color:#333;">You can always schedule a call with us if you'd like to discuss further.</p>`;
    sendEmail({
      to: client.email,
      subject: `Thank you for your feedback — ${proposal.title}`,
      html: wrapInBrandedTemplate({
        recipientName: client.fullName,
        bodyHtml: thankYouHtml,
        senderName: 'The BotMakers Team',
        senderTitle: null,
        ctaUrl: 'https://botmakers.ai/booking',
        ctaText: 'Schedule a Call',
      }),
    }).catch(() => {});

    // Notify team (email + bell)
    const reasonPreview = reason.trim().slice(0, 100);
    sendTeamNotification({
      type: 'proposal_declined',
      title: `${client.fullName} declined proposal: ${proposal.title}`,
      body: `Reason: ${reasonPreview}${reason.trim().length > 100 ? '...' : ''}`,
      link: `/proposals/${proposalId}`,
    }).catch(() => {});

    // Create follow-up reminder for 7 days from now
    if (proposal.leadId) {
      db.insert(followUpReminders).values({
        leadId: proposal.leadId,
        assignedTo: proposal.createdBy,
        remindAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        triggerReason: 'proposal_declined_followup',
      }).catch(() => {});
    }

    revalidatePath('/proposals');
    revalidatePath(`/proposals/${proposalId}`);

    return { success: true };
  } catch {
    return { error: 'Failed to decline proposal. Please try again.' };
  }
}

/**
 * Request changes to a proposal from the client portal.
 */
export async function requestProposalChanges(proposalId, changeRequest) {
  try {
    const cookieStore = await cookies();
    const { client } = await requireClient(cookieStore);

    if (!changeRequest || changeRequest.trim().length < 10) {
      return { error: 'Please provide at least 10 characters describing the changes.' };
    }

    // Validate proposal belongs to client
    const [proposal] = await db
      .select({
        id: proposals.id,
        clientId: proposals.clientId,
        status: proposals.status,
        title: proposals.title,
      })
      .from(proposals)
      .where(and(eq(proposals.id, proposalId), eq(proposals.clientId, client.id)))
      .limit(1);

    if (!proposal) {
      return { error: 'Proposal not found.' };
    }

    if (proposal.status === 'accepted') {
      return { error: 'This proposal has already been accepted.' };
    }

    if (proposal.status === 'declined') {
      return { error: 'This proposal has already been declined.' };
    }

    const now = new Date();

    // Update proposal
    await db
      .update(proposals)
      .set({
        status: 'changes_requested',
        changeRequest: changeRequest.trim(),
        changeRequestedAt: now,
        updatedAt: now,
      })
      .where(eq(proposals.id, proposalId));

    // Log activity
    db.insert(activityLog).values({
      actorId: client.id,
      actorType: 'client',
      action: 'proposal.changes_requested',
      entityType: 'proposal',
      entityId: proposalId,
      metadata: {
        clientName: client.fullName,
        proposalTitle: proposal.title,
        changeRequest: changeRequest.trim().slice(0, 200),
      },
    }).catch(() => {});

    // Send confirmation email to client
    const confirmHtml = `<p style="margin:0 0 16px; color:#333;">Thank you for your feedback on our proposal: <strong style="color:#033457;">${proposal.title}</strong></p>
      <p style="margin:0 0 16px; color:#333;">We'll review your requested changes and get back to you shortly with a revised proposal.</p>
      <p style="margin:0 0 16px; color:#333;">If you'd like to discuss the changes in person, feel free to schedule a call with us.</p>`;
    sendEmail({
      to: client.email,
      subject: `Changes requested — ${proposal.title}`,
      html: wrapInBrandedTemplate({
        recipientName: client.fullName,
        bodyHtml: confirmHtml,
        senderName: 'The BotMakers Team',
        senderTitle: null,
        ctaUrl: 'https://botmakers.ai/booking',
        ctaText: 'Schedule a Call',
      }),
    }).catch(() => {});

    // Notify team (email + bell)
    const changesPreview = changeRequest.trim().slice(0, 100);
    sendTeamNotification({
      type: 'proposal_changes_requested',
      title: `${client.fullName} requested changes to: ${proposal.title}`,
      body: `Details: ${changesPreview}${changeRequest.trim().length > 100 ? '...' : ''}`,
      link: `/proposals/${proposalId}`,
    }).catch(() => {});

    revalidatePath('/proposals');
    revalidatePath(`/proposals/${proposalId}`);

    return { success: true };
  } catch {
    return { error: 'Failed to submit change request. Please try again.' };
  }
}

/**
 * Track when a client logs into the portal.
 * Sets portalFirstLoginAt on first visit, always updates portalLastLoginAt.
 */
export async function trackPortalLogin(clientId, existingFirstLogin) {
  try {
    const now = new Date();
    const updateData = {
      portalLastLoginAt: now,
      updatedAt: now,
    };

    if (!existingFirstLogin) {
      updateData.portalFirstLoginAt = now;
    }

    await db.update(clients).set(updateData).where(eq(clients.id, clientId));

    // Log first login only (non-blocking — RLS may block)
    if (!existingFirstLogin) {
      db.insert(activityLog).values({
        actorId: clientId,
        actorType: 'client',
        action: 'portal.first_login',
        entityType: 'client',
        entityId: clientId,
      }).catch(() => {});
    }
  } catch {
    // Non-critical
  }
}

/**
 * Mark portal onboarding as complete for a client.
 */
export async function markOnboardingComplete() {
  try {
    const cookieStore = await cookies();
    const { client } = await requireClient(cookieStore);

    await db
      .update(clients)
      .set({ portalOnboardingComplete: true, updatedAt: new Date() })
      .where(eq(clients.id, client.id));

    return { success: true };
  } catch {
    return { error: 'Failed to complete onboarding.' };
  }
}
