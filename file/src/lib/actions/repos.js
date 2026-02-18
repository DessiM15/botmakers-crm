'use server';

import { db } from '@/lib/db/client';
import { projectRepos, projectDemos, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { validateRepo, getRepoCommits } from '@/lib/integrations/github';

/**
 * Link a GitHub repo to a project.
 */
export async function linkRepo(projectId, owner, repo) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!owner?.trim() || !repo?.trim()) {
      return { error: 'CB-API-001: Owner and repo name are required' };
    }

    const result = await validateRepo(owner.trim(), repo.trim());
    if (!result.valid) {
      return { error: `CB-INT-004: ${result.error}` };
    }

    const [newRepo] = await db
      .insert(projectRepos)
      .values({
        projectId,
        githubOwner: owner.trim(),
        githubRepo: repo.trim(),
        githubUrl: result.repo.url,
        defaultBranch: result.repo.defaultBranch,
        lastSyncedAt: new Date(),
      })
      .returning();

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'repo.linked',
      entityType: 'project',
      entityId: projectId,
      metadata: { repoId: newRepo.id, fullName: `${owner}/${repo}` },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true, repo: newRepo };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to link repository' };
  }
}

/**
 * Unlink a repo from a project.
 */
export async function unlinkRepo(repoId, projectId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [repo] = await db
      .select()
      .from(projectRepos)
      .where(eq(projectRepos.id, repoId))
      .limit(1);

    if (!repo) {
      return { error: 'CB-DB-002: Repository not found' };
    }

    await db.delete(projectRepos).where(eq(projectRepos.id, repoId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'repo.unlinked',
      entityType: 'project',
      entityId: projectId,
      metadata: { fullName: `${repo.githubOwner}/${repo.githubRepo}` },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to unlink repository' };
  }
}

/**
 * Sync a repo — re-fetch commits and update lastSyncedAt.
 */
export async function syncRepo(repoId) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const [repo] = await db
      .select()
      .from(projectRepos)
      .where(eq(projectRepos.id, repoId))
      .limit(1);

    if (!repo) {
      return { error: 'CB-DB-002: Repository not found' };
    }

    const result = await getRepoCommits(
      repo.githubOwner,
      repo.githubRepo,
      repo.defaultBranch,
      10
    );

    await db
      .update(projectRepos)
      .set({ lastSyncedAt: new Date() })
      .where(eq(projectRepos.id, repoId));

    revalidatePath(`/projects/${repo.projectId}`);

    return { success: true, commits: result.commits, error: result.error };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-INT-004: Failed to sync repository' };
  }
}

/**
 * Create a demo link for a project.
 */
export async function createDemo(projectId, data) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!data.title?.trim() || !data.url?.trim()) {
      return { error: 'CB-API-001: Title and URL are required' };
    }

    // Validate URL protocol to prevent javascript: URIs
    try {
      const parsed = new URL(data.url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { error: 'CB-API-001: URL must use https://' };
      }
    } catch {
      return { error: 'CB-API-001: Invalid URL format' };
    }

    const [demo] = await db
      .insert(projectDemos)
      .values({
        projectId,
        title: data.title.trim(),
        url: data.url.trim(),
        description: data.description?.trim() || null,
        phaseId: data.phaseId || null,
        isAutoPulled: false,
        isApproved: false,
        createdBy: teamUser.id,
      })
      .returning();

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'demo.created',
      entityType: 'project',
      entityId: projectId,
      metadata: { demoId: demo.id, title: data.title },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true, demo };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to create demo' };
  }
}

/**
 * Delete a demo link.
 */
export async function deleteDemo(demoId, projectId) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    await db.delete(projectDemos).where(eq(projectDemos.id, demoId));

    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to delete demo' };
  }
}

/**
 * Toggle demo approval status.
 */
export async function toggleDemoApproval(demoId, projectId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [demo] = await db
      .select()
      .from(projectDemos)
      .where(eq(projectDemos.id, demoId))
      .limit(1);

    if (!demo) {
      return { error: 'CB-DB-002: Demo not found' };
    }

    const newApproved = !demo.isApproved;

    await db
      .update(projectDemos)
      .set({ isApproved: newApproved })
      .where(eq(projectDemos.id, demoId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: newApproved ? 'demo.approved' : 'demo.unapproved',
      entityType: 'project',
      entityId: projectId,
      metadata: { demoId, title: demo.title },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true, isApproved: newApproved };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to toggle demo approval' };
  }
}
