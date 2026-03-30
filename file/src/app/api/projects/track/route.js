import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { db } from '@/lib/db/client';
import { projects, projectMilestones, activityLog, systemSettings } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { completeMilestoneInternal, handleMilestoneStarted } from '@/lib/actions/milestone-internal';

let _ratelimit;
function getRatelimit() {
  if (!_ratelimit) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    _ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: true,
      prefix: 'ratelimit:project-track',
    });
  }
  return _ratelimit;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ['in_progress', 'completed'];

export async function POST(request) {
  try {
    // Rate limit by IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    const { success: rateLimitOk } = await getRatelimit().limit(ip);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'CB-API-003: Rate limit exceeded' }, { status: 429 });
    }

    // Auth: Bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'CB-AUTH-001: Missing or invalid Authorization header' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    // Fetch stored API key
    const [keyRow] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'project_tracking_api_key'))
      .limit(1);

    const storedKey = keyRow?.value?.key;
    if (!storedKey) {
      return NextResponse.json({ error: 'CB-AUTH-001: Project tracking not configured' }, { status: 401 });
    }

    // Timing-safe compare
    const tokenBuf = Buffer.from(token);
    const storedBuf = Buffer.from(storedKey);
    if (tokenBuf.length !== storedBuf.length || !crypto.timingSafeEqual(tokenBuf, storedBuf)) {
      return NextResponse.json({ error: 'CB-AUTH-001: Invalid API key' }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const { project_id, milestones } = body;

    if (!project_id || !UUID_RE.test(project_id)) {
      return NextResponse.json({ error: 'CB-API-001: Invalid or missing project_id' }, { status: 400 });
    }
    if (!Array.isArray(milestones) || milestones.length === 0) {
      return NextResponse.json({ error: 'CB-API-001: milestones must be a non-empty array' }, { status: 400 });
    }
    if (milestones.length > 50) {
      return NextResponse.json({ error: 'CB-API-001: Maximum 50 milestones per request' }, { status: 400 });
    }

    // Validate each milestone entry
    for (const m of milestones) {
      if (!m.id || !UUID_RE.test(m.id)) {
        return NextResponse.json({ error: `CB-API-001: Invalid milestone id: ${m.id}` }, { status: 400 });
      }
      if (!VALID_STATUSES.includes(m.status)) {
        return NextResponse.json({ error: `CB-API-001: Invalid status "${m.status}" — must be in_progress or completed` }, { status: 400 });
      }
    }

    // Verify project exists
    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, project_id))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'CB-DB-002: Project not found' }, { status: 404 });
    }

    // Fetch all requested milestones in one query
    const milestoneIds = milestones.map((m) => m.id);
    const dbMilestones = await db
      .select()
      .from(projectMilestones)
      .where(
        and(
          eq(projectMilestones.projectId, project_id),
          inArray(projectMilestones.id, milestoneIds)
        )
      );

    const dbMap = new Map(dbMilestones.map((m) => [m.id, m]));

    // Verify all milestones belong to this project
    const missingIds = milestoneIds.filter((id) => !dbMap.has(id));
    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: `CB-DB-002: Milestones not found in this project: ${missingIds.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = [];
    const skipped = [];

    for (const req of milestones) {
      const existing = dbMap.get(req.id);

      // Skip if already in requested status
      if (existing.status === req.status) {
        skipped.push({ id: req.id, title: existing.title, reason: `already ${req.status}` });
        continue;
      }

      // Skip if trying to move backwards (completed → in_progress)
      if (existing.status === 'completed' && req.status === 'in_progress') {
        skipped.push({ id: req.id, title: existing.title, reason: 'already completed' });
        continue;
      }

      if (req.status === 'completed') {
        // Update DB status first
        await db
          .update(projectMilestones)
          .set({
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(projectMilestones.id, req.id));

        // Fire all downstream effects
        await completeMilestoneInternal(existing, {
          actorId: null,
          actorType: 'system',
          trigger: 'claude_code',
        });

        updated.push({ id: req.id, title: existing.title, status: 'completed' });
      } else if (req.status === 'in_progress') {
        await db
          .update(projectMilestones)
          .set({
            status: 'in_progress',
            updatedAt: new Date(),
          })
          .where(eq(projectMilestones.id, req.id));

        // Fire started effects (lead advance)
        await handleMilestoneStarted(existing);

        // Activity log for start
        await db.insert(activityLog).values({
          actorId: null,
          actorType: 'system',
          action: 'milestone.started',
          entityType: 'project',
          entityId: project_id,
          metadata: { milestoneId: req.id, title: existing.title, trigger: 'claude_code' },
        });

        updated.push({ id: req.id, title: existing.title, status: 'in_progress' });
      }
    }

    return NextResponse.json({ ok: true, updated, skipped });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'CB-API-001: Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
