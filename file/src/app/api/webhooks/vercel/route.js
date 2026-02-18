import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db/client';
import { projectRepos, projectDemos, activityLog } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Verify Vercel webhook signature.
 */
function verifySignature(body, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac('sha1', secret)
    .update(body)
    .digest('hex');
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
    const secret = process.env.VERCEL_WEBHOOK_SECRET;
    const body = await request.text();
    const signature = request.headers.get('x-vercel-signature');

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

    const payload = JSON.parse(body);

    // Only handle deployment.ready events
    if (payload.type !== 'deployment.ready') {
      return NextResponse.json({ message: `Ignored event: ${payload.type}` });
    }

    const deployment = payload.payload || payload;
    const previewUrl = deployment.url
      ? `https://${deployment.url}`
      : deployment.deploymentUrl;

    if (!previewUrl) {
      return NextResponse.json({ message: 'No preview URL in payload' });
    }

    // Try to match by repo info in the deployment
    const repoOwner = deployment.meta?.githubOrg || deployment.meta?.gitlabProjectNamespace;
    const repoName = deployment.meta?.githubRepo || deployment.meta?.gitlabProjectName;

    if (!repoOwner || !repoName) {
      return NextResponse.json({ message: 'No repo info in deployment' });
    }

    // Find matching project repos
    const matchingRepos = await db
      .select()
      .from(projectRepos)
      .where(
        and(
          eq(projectRepos.githubOwner, repoOwner),
          eq(projectRepos.githubRepo, repoName)
        )
      );

    if (matchingRepos.length === 0) {
      return NextResponse.json({ message: 'No matching projects' });
    }

    // Create auto-pulled demo for each matching project
    for (const repo of matchingRepos) {
      const [demo] = await db
        .insert(projectDemos)
        .values({
          projectId: repo.projectId,
          title: 'Vercel Preview',
          url: previewUrl,
          description: `Auto-pulled from Vercel deployment (${deployment.meta?.githubCommitRef || 'main'})`,
          isAutoPulled: true,
          isApproved: false,
        })
        .returning();

      await db.insert(activityLog).values({
        actorId: null,
        actorType: 'system',
        action: 'demo.auto_pulled',
        entityType: 'project',
        entityId: repo.projectId,
        metadata: {
          demoId: demo.id,
          url: previewUrl,
          repoFullName: `${repoOwner}/${repoName}`,
        },
      });
    }

    return NextResponse.json({
      message: 'Demo auto-pulled',
      projects: matchingRepos.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
