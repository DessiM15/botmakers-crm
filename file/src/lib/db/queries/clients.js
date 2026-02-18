import { db } from '@/lib/db/client';
import {
  clients,
  leads,
  referrers,
  teamUsers,
  projects,
  invoices,
} from '@/lib/db/schema';
import { eq, asc, desc, ilike, or, and, sql, count } from 'drizzle-orm';

/**
 * Fetch paginated, filtered, searchable clients list.
 */
export async function getClients({
  search = '',
  page = 1,
  perPage = 25,
} = {}) {
  const conditions = [];

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(clients.fullName, term),
        ilike(clients.email, term),
        ilike(clients.company, term)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * perPage;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: clients.id,
        fullName: clients.fullName,
        email: clients.email,
        company: clients.company,
        phone: clients.phone,
        authUserId: clients.authUserId,
        createdAt: clients.createdAt,
        projectCount: sql`(SELECT COUNT(*) FROM projects WHERE projects.client_id = ${clients.id})`.as('project_count'),
        openInvoiceTotal: sql`COALESCE((SELECT SUM(invoices.amount::numeric) FROM invoices WHERE invoices.client_id = ${clients.id} AND invoices.status IN ('sent', 'viewed', 'overdue')), 0)`.as('open_invoice_total'),
        lastContact: sql`(SELECT MAX(contacts.created_at) FROM contacts WHERE contacts.client_id = ${clients.id})`.as('last_contact'),
      })
      .from(clients)
      .where(whereClause)
      .orderBy(desc(clients.createdAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ total: count() })
      .from(clients)
      .where(whereClause),
  ]);

  return {
    clients: rows,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Fetch a single client by ID with related counts.
 */
export async function getClientById(id) {
  const [client] = await db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      email: clients.email,
      company: clients.company,
      phone: clients.phone,
      notes: clients.notes,
      authUserId: clients.authUserId,
      createdBy: clients.createdBy,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
      createdByName: teamUsers.fullName,
      projectCount: sql`(SELECT COUNT(*) FROM projects WHERE projects.client_id = ${clients.id})`.as('project_count'),
      proposalCount: sql`(SELECT COUNT(*) FROM proposals WHERE proposals.client_id = ${clients.id})`.as('proposal_count'),
      invoiceCount: sql`(SELECT COUNT(*) FROM invoices WHERE invoices.client_id = ${clients.id})`.as('invoice_count'),
      openInvoiceTotal: sql`COALESCE((SELECT SUM(invoices.amount::numeric) FROM invoices WHERE invoices.client_id = ${clients.id} AND invoices.status IN ('sent', 'viewed', 'overdue')), 0)`.as('open_invoice_total'),
    })
    .from(clients)
    .leftJoin(teamUsers, eq(clients.createdBy, teamUsers.id))
    .where(eq(clients.id, id))
    .limit(1);

  return client || null;
}

/**
 * Check if a client with the given email already exists.
 */
export async function getClientByEmail(email) {
  const [client] = await db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      email: clients.email,
    })
    .from(clients)
    .where(eq(clients.email, email.toLowerCase()))
    .limit(1);

  return client || null;
}

/**
 * Fetch all referrers with their total referral count.
 */
export async function getReferrers() {
  return db
    .select({
      id: referrers.id,
      fullName: referrers.fullName,
      email: referrers.email,
      company: referrers.company,
      feedback: referrers.feedback,
      totalReferrals: referrers.totalReferrals,
      createdAt: referrers.createdAt,
    })
    .from(referrers)
    .orderBy(desc(referrers.createdAt));
}

/**
 * Fetch a referrer with their referred leads.
 */
export async function getReferrerWithLeads(referrerId) {
  const referredLeads = await db
    .select({
      id: leads.id,
      fullName: leads.fullName,
      email: leads.email,
      companyName: leads.companyName,
      source: leads.source,
      score: leads.score,
      pipelineStage: leads.pipelineStage,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(eq(leads.referredBy, referrerId))
    .orderBy(desc(leads.createdAt));

  return referredLeads;
}
