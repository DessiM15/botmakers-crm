import { db } from '@/lib/db/client';
import { clients, leads, teamUsers } from '@/lib/db/schema';
import { desc, ilike, or, and, eq, count } from 'drizzle-orm';

/**
 * Fetch paginated, filtered, searchable contacts (union of leads + clients + team_users).
 */
export async function getAllContacts({
  search = '',
  typeFilter = 'all',
  page = 1,
  perPage = 25,
} = {}) {
  const offset = (page - 1) * perPage;
  const pattern = search.trim() ? `%${search.trim()}%` : null;

  let leadRows = [];
  let leadTotal = 0;
  let clientRows = [];
  let clientTotal = 0;
  let teamRows = [];
  let teamTotal = 0;

  // Fetch leads
  if (typeFilter === 'all' || typeFilter === 'lead') {
    const leadConditions = pattern
      ? or(
          ilike(leads.fullName, pattern),
          ilike(leads.email, pattern),
          ilike(leads.companyName, pattern),
          ilike(leads.phone, pattern)
        )
      : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: leads.id,
          fullName: leads.fullName,
          email: leads.email,
          company: leads.companyName,
          phone: leads.phone,
          createdAt: leads.createdAt,
        })
        .from(leads)
        .where(leadConditions)
        .orderBy(desc(leads.createdAt)),
      db
        .select({ total: count() })
        .from(leads)
        .where(leadConditions),
    ]);

    leadRows = rows.map((r) => ({ ...r, type: 'lead' }));
    leadTotal = total;
  }

  // Fetch clients
  if (typeFilter === 'all' || typeFilter === 'client') {
    const clientConditions = pattern
      ? or(
          ilike(clients.fullName, pattern),
          ilike(clients.email, pattern),
          ilike(clients.company, pattern),
          ilike(clients.phone, pattern)
        )
      : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: clients.id,
          fullName: clients.fullName,
          email: clients.email,
          company: clients.company,
          phone: clients.phone,
          createdAt: clients.createdAt,
        })
        .from(clients)
        .where(clientConditions)
        .orderBy(desc(clients.createdAt)),
      db
        .select({ total: count() })
        .from(clients)
        .where(clientConditions),
    ]);

    clientRows = rows.map((r) => ({ ...r, type: 'client' }));
    clientTotal = total;
  }

  // Fetch team members
  if (typeFilter === 'all' || typeFilter === 'teammate') {
    const teamWhere = pattern
      ? and(
          eq(teamUsers.isActive, true),
          or(ilike(teamUsers.fullName, pattern), ilike(teamUsers.email, pattern))
        )
      : eq(teamUsers.isActive, true);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: teamUsers.id,
          fullName: teamUsers.fullName,
          email: teamUsers.email,
          createdAt: teamUsers.createdAt,
        })
        .from(teamUsers)
        .where(teamWhere)
        .orderBy(desc(teamUsers.createdAt)),
      db
        .select({ total: count() })
        .from(teamUsers)
        .where(teamWhere),
    ]);

    teamRows = rows.map((r) => ({ ...r, company: null, phone: null, type: 'teammate' }));
    teamTotal = total;
  }

  // Merge, sort by createdAt desc, then paginate in JS
  const allContacts = [...leadRows, ...clientRows, ...teamRows].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const total = leadTotal + clientTotal + teamTotal;
  const paginated = allContacts.slice(offset, offset + perPage);

  return {
    contacts: paginated,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}
