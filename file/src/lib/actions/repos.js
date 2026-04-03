'use server';

import { db } from '@/lib/db/client';
import { projectRepos, projectDemos, activityLog, projects, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { validateRepo, getRepoCommits } from '@/lib/integrations/github';
import { projectPhases, projectMilestones } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { demoApprovedEmail } from '@/lib/email/notifications';
import { sendTeamNotification } from '@/lib/notifications/notify';
import { getProjectTrackingApiKeyRaw } from '@/lib/actions/settings';

/**
 * Parse a GitHub repo input — accepts URL or owner/repo format.
 * Examples:
 *   "https://github.com/BotMakersInc/Botmakers-CRM"
 *   "github.com/BotMakersInc/Botmakers-CRM"
 *   "BotMakersInc/Botmakers-CRM"
 */
function parseRepoInput(input) {
  if (!input?.trim()) return null;
  const trimmed = input.trim().replace(/\/+$/, ''); // remove trailing slashes

  // Try URL format: https://github.com/owner/repo or github.com/owner/repo
  const urlMatch = trimmed.match(/(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') };
  }

  // Try owner/repo format
  const slashMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slashMatch) {
    return { owner: slashMatch[1], repo: slashMatch[2].replace(/\.git$/, '') };
  }

  return null;
}

/**
 * Link a GitHub repo to a project.
 * Accepts a single input: GitHub URL, owner/repo, or separate owner + repo args.
 */
export async function linkRepo(projectId, repoInput, legacyRepo) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    let owner, repo;

    // Support both new (single input) and legacy (owner, repo) calling styles
    if (legacyRepo) {
      owner = repoInput?.trim();
      repo = legacyRepo?.trim();
    } else {
      const parsed = parseRepoInput(repoInput);
      if (!parsed) {
        return { error: 'CB-API-001: Paste a GitHub URL or enter owner/repo' };
      }
      owner = parsed.owner;
      repo = parsed.repo;
    }

    if (!owner || !repo) {
      return { error: 'CB-API-001: Could not parse repository. Use a GitHub URL or owner/repo format.' };
    }

    const result = await validateRepo(owner, repo);
    if (!result.valid) {
      return { error: `CB-INT-004: ${result.error}` };
    }

    const [newRepo] = await db
      .insert(projectRepos)
      .values({
        projectId,
        githubOwner: owner,
        githubRepo: repo,
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

    // Auto-scan for services (non-blocking)
    try {
      const { scanProjectServices } = await import('@/lib/actions/services');
      await scanProjectServices(projectId);
    } catch {
      // Scan failure should not block repo linking
    }

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

    // Auto-prepend https:// if no protocol provided
    let url = data.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Validate URL protocol to prevent javascript: URIs
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { error: 'CB-API-001: URL must use https://' };
      }
    } catch {
      return { error: 'CB-API-001: Invalid URL format' };
    }

    data.url = url;

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
 * Generate BOTMAKERS-CRM.md sync file content for a project.
 */
export async function generateSyncFile(projectId) {
  try {
    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) return { error: 'CB-DB-002: Project not found' };

    const phases = await db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, projectId))
      .orderBy(asc(projectPhases.sortOrder));

    const milestones = await db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId))
      .orderBy(asc(projectMilestones.sortOrder));

    let md = `# BOTMAKERS-CRM.md\n`;
    md += `# Project: ${project.name}\n`;
    md += `# Auto-generated sync file — do not delete this file\n\n`;
    md += `## Milestones\n\n`;

    for (const phase of phases) {
      md += `### ${phase.name}\n\n`;
      const phaseMs = milestones.filter((m) => m.phaseId === phase.id);
      for (const ms of phaseMs) {
        const checked = ms.status === 'completed' ? 'x' : ' ';
        md += `- [${checked}] ${ms.title}\n`;
      }
      md += '\n';
    }

    md += `---\n`;
    md += `Commit tags: Use \`[milestone: Milestone Name]\` in commit messages to auto-complete milestones.\n`;

    return { success: true, content: md };
  } catch (error) {
    return { error: 'CB-DB-001: Failed to generate sync file' };
  }
}

/**
 * Generate CLAUDE.md content for a project — instructs Claude Code to
 * automatically track milestone progress via the CRM API.
 */
export async function generateClaudeMd(projectId) {
  try {
    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) return { error: 'CB-DB-002: Project not found' };

    const phases = await db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, projectId))
      .orderBy(asc(projectPhases.sortOrder));

    const milestones = await db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId))
      .orderBy(asc(projectMilestones.sortOrder));

    const apiKey = await getProjectTrackingApiKeyRaw();

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');
    const endpoint = `${siteUrl}/api/projects/track`;

    let md = `# CLAUDE.md — Botmakers CRM Project Tracker\n\n`;
    md += `> Auto-generated file. Do not delete. Instructs Claude Code to keep the CRM in sync.\n\n`;
    md += `## Project\n\n`;
    md += `- **Name:** ${project.name}\n`;
    md += `- **Project ID:** \`${project.id}\`\n\n`;

    md += `## Auto-Tracking API\n\n`;
    md += `- **Endpoint:** \`POST ${endpoint}\`\n`;
    if (apiKey) {
      md += `- **Authorization:** \`Bearer ${apiKey}\`\n`;
    } else {
      md += `- **Authorization:** _(No API key configured — go to Settings > Integrations to generate one)_\n`;
    }
    md += `- **Content-Type:** \`application/json\`\n\n`;

    md += `## Milestones\n\n`;
    md += `| Phase | Milestone | ID | Status | Due Date |\n`;
    md += `|-------|-----------|----|---------|---------|\n`;

    for (const phase of phases) {
      const phaseMs = milestones.filter((m) => m.phaseId === phase.id);
      for (const ms of phaseMs) {
        const due = ms.dueDate ? new Date(ms.dueDate).toISOString().split('T')[0] : '—';
        md += `| ${phase.name} | ${ms.title} | \`${ms.id}\` | ${ms.status} | ${due} |\n`;
      }
    }

    md += `\n## Instructions for Claude Code\n\n`;
    md += `When working on this project, automatically update milestone status in the Botmakers CRM:\n\n`;
    md += `1. **When you begin work on a milestone**, call the API to set it to \`in_progress\`.\n`;
    md += `2. **When you are confident a milestone is complete**, call the API to set it to \`completed\`.\n`;
    md += `3. **Do not ask the user** before making these API calls — update automatically.\n`;
    md += `4. You may update multiple milestones in a single request.\n\n`;

    md += `### Request Format\n\n`;
    md += '```bash\n';
    md += `curl -X POST ${endpoint} \\\n`;
    if (apiKey) {
      md += `  -H "Authorization: Bearer ${apiKey}" \\\n`;
    } else {
      md += `  -H "Authorization: Bearer <API_KEY>" \\\n`;
    }
    md += `  -H "Content-Type: application/json" \\\n`;
    md += `  -d '{\n`;
    md += `    "project_id": "${project.id}",\n`;
    md += `    "milestones": [\n`;
    md += `      { "id": "<milestone_uuid>", "status": "completed" },\n`;
    md += `      { "id": "<milestone_uuid>", "status": "in_progress" }\n`;
    md += `    ]\n`;
    md += `  }'\n`;
    md += '```\n\n';

    md += `### Rules\n\n`;
    md += `- Only use statuses: \`in_progress\` or \`completed\`\n`;
    md += `- Milestones cannot go backwards (completed → in_progress is rejected)\n`;
    md += `- Duplicate updates are safe (idempotent — already-completed milestones are skipped)\n`;
    md += `- The API returns \`{ ok: true, updated: [...], skipped: [...] }\`\n`;

    return { success: true, content: md, hasApiKey: !!apiKey };
  } catch {
    return { error: 'CB-DB-001: Failed to generate CLAUDE.md' };
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

    // In-app notification when demo is approved
    if (newApproved) {
      sendTeamNotification({
        type: 'demo_approved',
        title: `Demo approved: ${demo.title}`,
        body: `Demo "${demo.title}" has been approved and is now visible in the client portal`,
        link: `/projects/${projectId}`,
        excludeUserId: teamUser.id,
      }).catch(() => {});
    }

    // Send client email when demo is approved (non-blocking)
    if (newApproved) {
      const [proj] = await db
        .select({ clientId: projects.clientId, name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (proj?.clientId) {
        const [client] = await db
          .select({ email: clients.email, fullName: clients.fullName })
          .from(clients)
          .where(eq(clients.id, proj.clientId))
          .limit(1);
        if (client) {
          demoApprovedEmail(client.email, client.fullName, demo.title, demo.url, proj.name).catch(() => {});
        }
      }
    }

    revalidatePath(`/projects/${projectId}`);

    return { success: true, isApproved: newApproved };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to toggle demo approval' };
  }
}
