import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { invoices, clients } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const rows = await db
      .select({
        id: invoices.id,
        title: invoices.title,
        clientName: clients.fullName,
        clientEmail: clients.email,
        amount: invoices.amount,
        status: invoices.status,
        dueDate: invoices.dueDate,
        sentAt: invoices.sentAt,
        paidAt: invoices.paidAt,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .orderBy(desc(invoices.createdAt))
      .limit(5000);

    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
