import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateLeadResponseWithAI } from '@/lib/ai/client';

/**
 * POST /api/ai/generate-lead-response
 * Generate a personalized outreach email for a lead using AI.
 * Requires team auth.
 * Body: { leadId: "uuid" }
 */
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const body = await request.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'CB-API-001: leadId is required' }, { status: 400 });
    }

    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'CB-DB-002: Lead not found' }, { status: 404 });
    }

    const email = await generateLeadResponseWithAI(lead);

    return NextResponse.json({
      success: true,
      email,
    });
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'CB-INT-002: AI generation failed' }, { status: 500 });
  }
}
