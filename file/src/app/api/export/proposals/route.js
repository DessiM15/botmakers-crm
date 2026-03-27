import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { proposals, clients, leads } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const rows = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        clientName: clients.fullName,
        leadName: leads.fullName,
        totalAmount: proposals.totalAmount,
        status: proposals.status,
        sentAt: proposals.sentAt,
        acceptedAt: proposals.acceptedAt,
        createdAt: proposals.createdAt,
      })
      .from(proposals)
      .leftJoin(clients, eq(proposals.clientId, clients.id))
      .leftJoin(leads, eq(proposals.leadId, leads.id))
      .orderBy(desc(proposals.createdAt))
      .limit(5000);

    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
