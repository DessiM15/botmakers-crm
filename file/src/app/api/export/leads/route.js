import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const rows = await db
      .select({
        id: leads.id,
        fullName: leads.fullName,
        email: leads.email,
        phone: leads.phone,
        companyName: leads.companyName,
        source: leads.source,
        pipelineStage: leads.pipelineStage,
        score: leads.score,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .orderBy(desc(leads.createdAt))
      .limit(5000);

    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
