import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { leads, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateProposalWithAI } from '@/lib/ai/client';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const body = await request.json();
    const { leadId, clientId, discoveryNotes, pricingType } = body;

    if (!discoveryNotes?.trim()) {
      return NextResponse.json(
        { error: 'CB-API-001: Discovery notes are required for AI generation' },
        { status: 400 }
      );
    }

    let leadData = {};

    // Fetch lead data if provided
    if (leadId) {
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1);
      if (lead) {
        leadData = lead;
      }
    }

    // Fetch client data if provided (and no lead data)
    if (clientId && !leadData.id) {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      if (client) {
        leadData = {
          fullName: client.fullName,
          email: client.email,
          companyName: client.company,
        };
      }
    }

    const proposal = await generateProposalWithAI({
      leadData,
      discoveryNotes,
      pricingType: pricingType || 'fixed',
    });

    return NextResponse.json({ success: true, proposal });
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'CB-INT-002: AI proposal generation failed' },
      { status: 500 }
    );
  }
}
