import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { clients } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const rows = await db
      .select({
        id: clients.id,
        fullName: clients.fullName,
        email: clients.email,
        phone: clients.phone,
        company: clients.company,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .orderBy(desc(clients.createdAt))
      .limit(5000);

    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
