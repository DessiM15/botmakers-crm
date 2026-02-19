import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { analyzeLeadWithAI } from '@/lib/ai/client';

export async function POST(request) {
  // Auth check first — return early on failure
  let cookieStore;
  try {
    cookieStore = await cookies();
    await requireTeam(cookieStore);
  } catch {
    return NextResponse.json(
      { error: 'CB-AUTH-003: Not authorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'CB-API-001: lead_id is required' },
        { status: 400 }
      );
    }

    // Fetch lead data
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json(
        { error: 'CB-DB-002: Lead not found' },
        { status: 404 }
      );
    }

    // Run AI analysis
    const analysis = await analyzeLeadWithAI(lead);

    // Store results
    await db
      .update(leads)
      .set({
        aiInternalAnalysis: analysis,
        aiProspectSummary: analysis.prospect_summary,
        score: analysis.score,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    return NextResponse.json({ success: true, analysis });
  } catch {
    return NextResponse.json(
      { error: 'CB-INT-002: AI analysis failed' },
      { status: 500 }
    );
  }
}
