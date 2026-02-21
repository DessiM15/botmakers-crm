'use server';

import { db } from '@/lib/db/client';
import { createAdminClient } from '@/lib/db/client';
import { clients, proposals, projects, projectQuestions, activityLog } from '@/lib/db/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { requireClient } from '@/lib/auth/helpers';
import { proposalAccepted as proposalAcceptedNotif, clientQuestion as clientQuestionNotif } from '@/lib/email/notifications';
import { advanceLead } from '@/lib/pipeline/transitions';
import { sendTeamNotification } from '@/lib/notifications/notify';
import { sendEmail } from '@/lib/email/client';
import { wrapInBrandedTemplate } from '@/lib/email/branded-template';
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
 */
export async function sendMagicLink(email) {
  try {
    if (!email || !email.includes('@')) {
      return { error: 'Please enter a valid email address.' };
    }

    const normalizedEmail = email.toLowerCase().trim();

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
        redirectTo: `${siteUrl}/auth/callback?next=/portal`,
      },
    });

    if (linkError) {
      return { error: 'Failed to generate login link. Please try again.' };
    }

    // Build the actual magic link URL from the token hash
    const tokenHash = linkData?.properties?.hashed_token;
    const magicLinkUrl = `${siteUrl}/auth/callback?token_hash=${tokenHash}&type=magiclink&next=/portal`;

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
    console.error('submitQuestion error:', err);
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

    return { success: true };
  } catch {
    return { error: 'Failed to accept proposal. Please try again.' };
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
