import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getTeamUser } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { leads, clients, projects, proposals, invoices } from '@/lib/db/schema';
import { or, ilike, desc, sql } from 'drizzle-orm';

const MAX_PER_TYPE = 5;

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await getTeamUser(cookieStore);
    if (!teamUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const pattern = `%${q}%`;

    const [leadResults, clientResults, projectResults, proposalResults, invoiceResults] = await Promise.all([
      db.select({
        id: leads.id,
        title: leads.fullName,
        subtitle: leads.email,
      })
        .from(leads)
        .where(or(ilike(leads.fullName, pattern), ilike(leads.email, pattern), ilike(leads.companyName, pattern)))
        .orderBy(desc(leads.createdAt))
        .limit(MAX_PER_TYPE),

      db.select({
        id: clients.id,
        title: clients.fullName,
        subtitle: clients.email,
      })
        .from(clients)
        .where(or(ilike(clients.fullName, pattern), ilike(clients.email, pattern), ilike(clients.company, pattern)))
        .orderBy(desc(clients.createdAt))
        .limit(MAX_PER_TYPE),

      db.select({
        id: projects.id,
        title: projects.name,
        subtitle: sql`NULL`,
      })
        .from(projects)
        .where(or(ilike(projects.name, pattern), ilike(projects.description, pattern)))
        .orderBy(desc(projects.createdAt))
        .limit(MAX_PER_TYPE),

      db.select({
        id: proposals.id,
        title: proposals.title,
        subtitle: sql`NULL`,
      })
        .from(proposals)
        .where(ilike(proposals.title, pattern))
        .orderBy(desc(proposals.createdAt))
        .limit(MAX_PER_TYPE),

      db.select({
        id: invoices.id,
        title: invoices.title,
        subtitle: sql`NULL`,
      })
        .from(invoices)
        .where(ilike(invoices.title, pattern))
        .orderBy(desc(invoices.createdAt))
        .limit(MAX_PER_TYPE),
    ]);

    const results = [
      ...leadResults.map(r => ({ ...r, type: 'lead', link: `/leads/${r.id}` })),
      ...clientResults.map(r => ({ ...r, type: 'client', link: `/clients/${r.id}` })),
      ...projectResults.map(r => ({ ...r, type: 'project', link: `/projects/${r.id}` })),
      ...proposalResults.map(r => ({ ...r, type: 'proposal', link: `/proposals/${r.id}` })),
      ...invoiceResults.map(r => ({ ...r, type: 'invoice', link: `/invoices/${r.id}` })),
    ];

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
