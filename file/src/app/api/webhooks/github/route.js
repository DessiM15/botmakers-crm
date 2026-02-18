import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db/client';
import { projectRepos, activityLog } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

export async function POST(request) {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    // Reject if webhook secret is not configured
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

    // Only handle push events
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
    }

    return NextResponse.json({
      message: 'Push processed',
      updatedRepos: matchingRepos.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
