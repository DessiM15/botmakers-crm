'use server';

import { db } from '@/lib/db/client';
import { projectQuestions, projects, clients, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireTeam } from '@/lib/auth/helpers';
import { questionRepliedEmail } from '@/lib/email/notifications';

/**
 * Save a draft reply for a question (CRM-side).
 */
export async function saveDraftReply(questionId, draftText) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    await db
      .update(projectQuestions)
      .set({ replyDraft: draftText })
      .where(eq(projectQuestions.id, questionId));

    return { success: true };
  } catch {
    return { error: 'Failed to save draft.' };
  }
}

/**
 * Send the final reply to a client question.
 */
export async function sendReply(questionId, replyText) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!replyText || replyText.trim().length < 1) {
      return { error: 'Reply cannot be empty.' };
    }

    // Get question + project + client info
    const [question] = await db
      .select()
      .from(projectQuestions)
      .where(eq(projectQuestions.id, questionId))
      .limit(1);

    if (!question) return { error: 'Question not found.' };

    const [project] = await db
      .select({ id: projects.id, name: projects.name, clientId: projects.clientId })
      .from(projects)
      .where(eq(projects.id, question.projectId))
      .limit(1);

    const [client] = await db
      .select({ email: clients.email, fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.id, question.clientId))
      .limit(1);

    // Update question
    await db
      .update(projectQuestions)
      .set({
        replyText: replyText.trim(),
        status: 'replied',
        repliedBy: teamUser.id,
        repliedAt: new Date(),
      })
      .where(eq(projectQuestions.id, questionId));

    // Log activity
    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'question.replied',
      entityType: 'project',
      entityId: question.projectId,
      metadata: { questionId },
    });

    // Email client
    if (client) {
      await questionRepliedEmail(
        client.email,
        client.fullName,
        project?.name || 'your project',
        replyText.trim()
      );
    }

    revalidatePath(`/projects/${question.projectId}`);

    return { success: true };
  } catch {
    return { error: 'Failed to send reply.' };
  }
}
