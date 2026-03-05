import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db/client';
import { projectRepos, projectMilestones, projectPhases, activityLog } from '@/lib/db/schema';
import { eq, and, ilike } from 'drizzle-orm';
import { getRepoFileContent } from '@/lib/integrations/github';

/**
 * Verify GitHub webhook signature (X-Hub-Signature-256).
 */
function verifySignature(payload, signature, secret) {
  if (!secret || !signature) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/**
 * Parse [milestone: Name] tags from commit messages.
 */
function parseCommitTags(commits) {
  const tags = [];
  const regex = /\[milestone:\s*([^\]]+)\]/gi;
  for (const commit of commits || []) {
    let match;
    while ((match = regex.exec(commit.message)) !== null) {
      tags.push({ name: match[1].trim(), commitSha: commit.id, commitMessage: commit.message });
    }
  }
  return tags;
}

/**
 * Parse checkboxes from BOTMAKERS-CRM.md content.
 * Returns array of { title, completed }.
 */
function parseSyncFileCheckboxes(content) {
  const results = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^-\s*\[([ xX])\]\s+(.+)$/);
    if (match) {
      results.push({
        title: match[2].trim(),
        completed: match[1].toLowerCase() === 'x',
      });
    }
  }
  return results;
}

export async function POST(request) {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (!secret) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 503 }
      );
    }

    if (!verifySignature(body, signature, secret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = request.headers.get('x-github-event');
    const payload = JSON.parse(body);

    if (event !== 'push') {
      return NextResponse.json({ message: `Ignored event: ${event}` });
    }

    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      return NextResponse.json({ message: 'No repository in payload' });
    }

    const [owner, repo] = repoFullName.split('/');

    // Find matching project repos
    const matchingRepos = await db
      .select()
      .from(projectRepos)
      .where(
        and(
          eq(projectRepos.githubOwner, owner),
          eq(projectRepos.githubRepo, repo)
        )
      );

    if (matchingRepos.length === 0) {
      return NextResponse.json({ message: 'No matching projects' });
    }

    let milestoneUpdates = 0;

    // Update last_synced_at for all matching repos
    for (const r of matchingRepos) {
      await db
        .update(projectRepos)
        .set({ lastSyncedAt: new Date() })
        .where(eq(projectRepos.id, r.id));

      await db.insert(activityLog).values({
        actorId: null,
        actorType: 'system',
        action: 'repo.push_received',
        entityType: 'project',
        entityId: r.projectId,
        metadata: {
          repoFullName,
          ref: payload.ref,
          pusher: payload.pusher?.name,
          commits: payload.commits?.length || 0,
        },
      });

      // ── Commit tag parsing ──
      const commitTags = parseCommitTags(payload.commits);
      for (const tag of commitTags) {
        // Fuzzy match: case-insensitive title match against project milestones
        const [milestone] = await db
          .select()
          .from(projectMilestones)
          .where(
            and(
              eq(projectMilestones.projectId, r.projectId),
              ilike(projectMilestones.title, tag.name)
            )
          )
          .limit(1);

        if (milestone && milestone.status !== 'completed') {
          await db
            .update(projectMilestones)
            .set({
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(projectMilestones.id, milestone.id));

          await db.insert(activityLog).values({
            actorId: null,
            actorType: 'system',
            action: 'milestone.auto_completed',
            entityType: 'project',
            entityId: r.projectId,
            metadata: {
              milestoneId: milestone.id,
              milestoneTitle: milestone.title,
              commitSha: tag.commitSha,
              trigger: 'commit_tag',
            },
          });

          milestoneUpdates++;
        }
      }

      // ── Sync file parsing ──
      const modifiedFiles = (payload.commits || []).flatMap((c) => [
        ...(c.modified || []),
        ...(c.added || []),
      ]);

      if (modifiedFiles.includes('BOTMAKERS-CRM.md')) {
        const branch = payload.ref?.replace('refs/heads/', '') || r.defaultBranch;
        const content = await getRepoFileContent(owner, repo, 'BOTMAKERS-CRM.md', branch);

        if (content) {
          const checkboxes = parseSyncFileCheckboxes(content);

          // Get all milestones for this project
          const allMilestones = await db
            .select()
            .from(projectMilestones)
            .where(eq(projectMilestones.projectId, r.projectId));

          for (const cb of checkboxes) {
            const ms = allMilestones.find(
              (m) => m.title.toLowerCase() === cb.title.toLowerCase()
            );
            if (!ms) continue;

            // Only update if state changed
            if (cb.completed && ms.status !== 'completed') {
              await db
                .update(projectMilestones)
                .set({
                  status: 'completed',
                  completedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(projectMilestones.id, ms.id));

              await db.insert(activityLog).values({
                actorId: null,
                actorType: 'system',
                action: 'milestone.auto_completed',
                entityType: 'project',
                entityId: r.projectId,
                metadata: {
                  milestoneId: ms.id,
                  milestoneTitle: ms.title,
                  trigger: 'sync_file',
                },
              });

              milestoneUpdates++;
            } else if (!cb.completed && ms.status === 'completed') {
              // Allow un-checking to revert to in_progress
              await db
                .update(projectMilestones)
                .set({
                  status: 'in_progress',
                  completedAt: null,
                  updatedAt: new Date(),
                })
                .where(eq(projectMilestones.id, ms.id));

              await db.insert(activityLog).values({
                actorId: null,
                actorType: 'system',
                action: 'milestone.auto_reverted',
                entityType: 'project',
                entityId: r.projectId,
                metadata: {
                  milestoneId: ms.id,
                  milestoneTitle: ms.title,
                  trigger: 'sync_file',
                },
              });

              milestoneUpdates++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      message: 'Push processed',
      updatedRepos: matchingRepos.length,
      milestoneUpdates,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
