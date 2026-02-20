import { db } from '@/lib/db/client';
import {
  proposals,
  proposalLineItems,
  leads,
  clients,
  teamUsers,
} from '@/lib/db/schema';
import { eq, desc, and, count, sql, ilike, or } from 'drizzle-orm';

/**
 * Fetch paginated, filterable proposals list.
 */
export async function getProposals({
  search = '',
  status = 'all',
  page = 1,
  perPage = 25,
} = {}) {
  const conditions = [];

  if (status !== 'all') {
    conditions.push(eq(proposals.status, status));
  }

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(proposals.title, term),
        sql`EXISTS (SELECT 1 FROM clients WHERE clients.id = ${proposals.clientId} AND (${ilike(clients.fullName, term)} OR ${ilike(clients.company, term)}))`,
        sql`EXISTS (SELECT 1 FROM leads WHERE leads.id = ${proposals.leadId} AND ${ilike(leads.fullName, term)})`
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * perPage;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: proposals.id,
        title: proposals.title,
        status: proposals.status,
        pricingType: proposals.pricingType,
        totalAmount: proposals.totalAmount,
        sentAt: proposals.sentAt,
        createdAt: proposals.createdAt,
        leadId: proposals.leadId,
        clientId: proposals.clientId,
        leadName: sql`(SELECT leads.full_name FROM leads WHERE leads.id = ${proposals.leadId})`.as('lead_name'),
        clientName: sql`(SELECT clients.full_name FROM clients WHERE clients.id = ${proposals.clientId})`.as('client_name'),
        clientCompany: sql`(SELECT clients.company FROM clients WHERE clients.id = ${proposals.clientId})`.as('client_company'),
        viewedAt: proposals.viewedAt,
        viewedCount: proposals.viewedCount,
        signedAt: proposals.signedAt,
        signerName: proposals.signerName,
        createdByName: teamUsers.fullName,
      })
      .from(proposals)
      .leftJoin(teamUsers, eq(proposals.createdBy, teamUsers.id))
      .where(whereClause)
      .orderBy(desc(proposals.createdAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ total: count() })
      .from(proposals)
      .where(whereClause),
  ]);

  return {
    proposals: rows,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Fetch a single proposal by ID with line items.
 */
export async function getProposalById(id) {
  const [proposal] = await db
    .select({
      id: proposals.id,
      leadId: proposals.leadId,
      clientId: proposals.clientId,
      projectId: proposals.projectId,
      title: proposals.title,
      scopeOfWork: proposals.scopeOfWork,
      deliverables: proposals.deliverables,
      termsAndConditions: proposals.termsAndConditions,
      pricingType: proposals.pricingType,
      totalAmount: proposals.totalAmount,
      status: proposals.status,
      sentAt: proposals.sentAt,
      viewedAt: proposals.viewedAt,
      acceptedAt: proposals.acceptedAt,
      declinedAt: proposals.declinedAt,
      expiresAt: proposals.expiresAt,
      viewedCount: proposals.viewedCount,
      signedAt: proposals.signedAt,
      signerName: proposals.signerName,
      signerIp: proposals.signerIp,
      signedPdfUrl: proposals.signedPdfUrl,
      clientSignature: proposals.clientSignature,
      aiGenerated: proposals.aiGenerated,
      aiPromptContext: proposals.aiPromptContext,
      createdBy: proposals.createdBy,
      createdAt: proposals.createdAt,
      updatedAt: proposals.updatedAt,
      leadName: sql`(SELECT leads.full_name FROM leads WHERE leads.id = ${proposals.leadId})`.as('lead_name'),
      leadEmail: sql`(SELECT leads.email FROM leads WHERE leads.id = ${proposals.leadId})`.as('lead_email'),
      clientName: sql`(SELECT clients.full_name FROM clients WHERE clients.id = ${proposals.clientId})`.as('client_name'),
      clientEmail: sql`(SELECT clients.email FROM clients WHERE clients.id = ${proposals.clientId})`.as('client_email'),
      clientCompany: sql`(SELECT clients.company FROM clients WHERE clients.id = ${proposals.clientId})`.as('client_company'),
      createdByName: teamUsers.fullName,
    })
    .from(proposals)
    .leftJoin(teamUsers, eq(proposals.createdBy, teamUsers.id))
    .where(eq(proposals.id, id))
    .limit(1);

  if (!proposal) return null;

  const lineItems = await db
    .select()
    .from(proposalLineItems)
    .where(eq(proposalLineItems.proposalId, id))
    .orderBy(proposalLineItems.sortOrder);

  return { ...proposal, lineItems };
}

/**
 * Fetch proposals for a specific client.
 */
export async function getProposalsByClientId(clientId) {
  return db
    .select({
      id: proposals.id,
      title: proposals.title,
      status: proposals.status,
      totalAmount: proposals.totalAmount,
      sentAt: proposals.sentAt,
      createdAt: proposals.createdAt,
    })
    .from(proposals)
    .where(eq(proposals.clientId, clientId))
    .orderBy(desc(proposals.createdAt));
}

/**
 * Fetch leads and clients for the proposal wizard dropdown.
 */
export async function getLeadsAndClientsForDropdown() {
  const [leadRows, clientRows] = await Promise.all([
    db
      .select({
        id: leads.id,
        fullName: leads.fullName,
        email: leads.email,
        companyName: leads.companyName,
        aiProspectSummary: leads.aiProspectSummary,
        aiInternalAnalysis: leads.aiInternalAnalysis,
        projectDetails: leads.projectDetails,
        projectType: leads.projectType,
      })
      .from(leads)
      .orderBy(desc(leads.createdAt)),
    db
      .select({
        id: clients.id,
        fullName: clients.fullName,
        email: clients.email,
        company: clients.company,
      })
      .from(clients)
      .orderBy(desc(clients.createdAt)),
  ]);

  return { leads: leadRows, clients: clientRows };
}
