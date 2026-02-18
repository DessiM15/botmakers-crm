import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createAdminClient } from '@/lib/db/client';
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

    // Use admin client (service role, bypasses RLS) to check team_users
    const admin = createAdminClient();
    const { data: teamUser, error: dbErr } = await admin
      .from('team_users')
      .select('id, email, full_name, role, is_active')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (dbErr) {
      return NextResponse.json(
        { error: 'Database error. Please try again.', code: 'CB-DB-001', debug: dbErr.message },
        { status: 500 }
      );
    }

    if (!teamUser) {
      return NextResponse.json(
        { error: 'Invalid email or password.', code: 'CB-AUTH-001' },
        { status: 401 }
      );
    }

    if (!teamUser.is_active) {
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
