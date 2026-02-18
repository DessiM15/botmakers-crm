'use server';

import { db } from '@/lib/db/client';
import { createAdminClient } from '@/lib/db/client';
import { clients, proposals, projects, projectQuestions, activityLog } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { requireClient } from '@/lib/auth/helpers';
import { proposalAccepted as proposalAcceptedNotif, clientQuestion as clientQuestionNotif } from '@/lib/email/notifications';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const magicLinkLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'ratelimit:magic-link',
});

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
    const { success: withinLimit } = await magicLinkLimiter.limit(normalizedEmail);
    if (!withinLimit) {
      return { error: 'Too many login attempts. Please try again later.' };
    }

    // Validate email exists in clients table
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.email, normalizedEmail))
      .limit(1);

    if (!client) {
      return { error: 'No account found — contact info@botmakers.ai' };
    }

    // Send magic link via Supabase Auth
    const supabase = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${siteUrl}/portal`,
      },
    });

    if (error) {
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

    // Log activity
    await db.insert(activityLog).values({
      actorId: client.id,
      actorType: 'client',
      action: 'question.created',
      entityType: 'project',
      entityId: projectId,
      metadata: { questionId: question.id },
    });

    // Notify team (non-blocking)
    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (project) {
      clientQuestionNotif(project, question, client.fullName).catch(() => {});
    }

    return { success: true, question };
  } catch {
    return { error: 'Failed to submit question. Please try again.' };
  }
}

/**
 * Track when a client first views a proposal.
 */
export async function trackProposalView(proposalId) {
  try {
    const cookieStore = await cookies();
    const { client } = await requireClient(cookieStore);

    // Only set viewedAt on first view
    const [proposal] = await db
      .select({ viewedAt: proposals.viewedAt, clientId: proposals.clientId })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal || proposal.clientId !== client.id) return;

    if (!proposal.viewedAt) {
      await db
        .update(proposals)
        .set({
          viewedAt: new Date(),
          status: 'viewed',
        })
        .where(eq(proposals.id, proposalId));
    }
  } catch {
    // Non-critical — don't fail the page
  }
}

/**
 * Accept and sign a proposal from the client portal.
 */
export async function acceptProposal(proposalId, signature) {
  try {
    const cookieStore = await cookies();
    const { client } = await requireClient(cookieStore);

    if (!signature || signature.trim().length < 2) {
      return { error: 'Please type your full name as signature.' };
    }

    // Validate proposal belongs to client
    const [proposal] = await db
      .select({
        id: proposals.id,
        clientId: proposals.clientId,
        status: proposals.status,
        expiresAt: proposals.expiresAt,
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

    if (proposal.expiresAt && new Date(proposal.expiresAt) < new Date()) {
      return { error: 'This proposal has expired.' };
    }

    // Update proposal
    await db
      .update(proposals)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        clientSignature: signature.trim(),
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalId));

    // Log activity
    await db.insert(activityLog).values({
      actorId: client.id,
      actorType: 'client',
      action: 'proposal.accepted',
      entityType: 'proposal',
      entityId: proposalId,
      metadata: { clientName: client.fullName, proposalTitle: proposal.title },
    });

    // Notify team (non-blocking)
    proposalAcceptedNotif(proposal, client.fullName).catch(() => {});

    return { success: true };
  } catch {
    return { error: 'Failed to accept proposal. Please try again.' };
  }
}
