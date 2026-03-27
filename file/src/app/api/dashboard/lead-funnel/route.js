import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const rows = await db
      .select({
        stage: leads.pipelineStage,
        count: sql`count(*)::int`,
      })
      .from(leads)
      .groupBy(leads.pipelineStage);

    return NextResponse.json({ stages: rows });
  } catch {
    return NextResponse.json({ stages: [] });
  }
}
