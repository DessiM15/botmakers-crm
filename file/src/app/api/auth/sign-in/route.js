import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { db } from '@/lib/db/client';
import { teamUsers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

let _ratelimit;
function getRatelimit() {
  if (!_ratelimit) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    _ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '15 m'), // TODO: revert to 5 after login testing
      analytics: true,
      prefix: 'ratelimit:signin',
    });
  }
  return _ratelimit;
}

export async function POST(request) {
  try {
    // Rate limit by IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    const { success, remaining } = await getRatelimit().limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in 15 minutes.', code: 'CB-API-003' },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.', code: 'CB-API-001' },
        { status: 400 }
      );
    }

    // Use admin client to check team_users first
    const [teamUser] = await db
      .select()
      .from(teamUsers)
      .where(eq(teamUsers.email, email.toLowerCase().trim()))
      .limit(1);

    if (!teamUser) {
      return NextResponse.json(
        { error: 'Invalid email or password.', code: 'CB-AUTH-001' },
        { status: 401 }
      );
    }

    if (!teamUser.isActive) {
      return NextResponse.json(
        { error: 'Your account has been disabled. Contact an administrator.', code: 'CB-AUTH-001' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { ok: true, remaining },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.', code: 'CB-AUTH-001', debug: err.message },
      { status: 500 }
    );
  }
}
