import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { processDiscoveryCallWithAI } from '@/lib/ai/client';

export async function POST(request) {
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
    const { leadId, transcript, pricingType = 'fixed' } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'CB-API-001: leadId is required' },
        { status: 400 }
      );
    }

    if (!transcript || transcript.trim().length < 50) {
      return NextResponse.json(
        { error: 'CB-API-001: Transcript must be at least 50 characters' },
        { status: 400 }
      );
    }

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

    const result = await processDiscoveryCallWithAI({
      leadData: lead,
      transcript,
      pricingType,
    });

    const now = new Date();
    await db
      .update(leads)
      .set({
        discoveryTranscript: transcript,
        discoveryCallSummary: result.summary,
        discoveryCallProcessedAt: now,
        updatedAt: now,
      })
      .where(eq(leads.id, leadId));

    return NextResponse.json({
      success: true,
      summary: result.summary,
      proposal: result.proposal,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Discovery call processing error:', err?.message || err);
    }
    return NextResponse.json(
      { error: 'CB-INT-002: AI processing failed' },
      { status: 500 }
    );
  }
}
