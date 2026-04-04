import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/helpers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    await requireAdmin(cookieStore);

    const current = cookieStore.get('demo_mode')?.value === 'true';
    const next = !current;

    const res = NextResponse.json({ demoMode: next });

    if (next) {
      res.cookies.set('demo_mode', 'true', {
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });
    } else {
      res.cookies.delete('demo_mode');
    }

    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Unauthorized' },
      { status: 403 }
    );
  }
}
