import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { systemSettings } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    const [setting] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(sql`${systemSettings.key} = ${key}`)
      .limit(1);

    return NextResponse.json({ value: setting?.value ?? null });
  } catch (error) {
    return NextResponse.json({ value: null });
  }
}
