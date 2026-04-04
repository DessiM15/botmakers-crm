import { db } from '@/lib/db/client';
import {
  invoices,
  invoiceLineItems,
  payments,
  clients,
  projects,
  teamUsers,
} from '@/lib/db/schema';
import { eq, desc, and, count, sql, ilike, or, sum } from 'drizzle-orm';
import { isDemoMode } from '@/lib/utils/demo';

/**
 * Fetch paginated, filterable invoices list.
 */
export async function getInvoices({
  search = '',
  status = 'all',
  page = 1,
  perPage = 25,
} = {}) {
  const isDemo = await isDemoMode();
  const conditions = [];

  // Filter by demo mode
  conditions.push(eq(invoices.isDemo, isDemo));

  if (status !== 'all') {
    conditions.push(eq(invoices.status, status));
  }

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(invoices.title, term),
        sql`EXISTS (SELECT 1 FROM clients WHERE clients.id = ${invoices.clientId} AND (${ilike(clients.fullName, term)} OR ${ilike(clients.company, term)}))`
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * perPage;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: invoices.id,
        title: invoices.title,
        status: invoices.status,
        amount: invoices.amount,
        dueDate: invoices.dueDate,
        sentAt: invoices.sentAt,
        paidAt: invoices.paidAt,
        createdAt: invoices.createdAt,
        clientId: invoices.clientId,
        projectId: invoices.projectId,
        squareInvoiceId: invoices.squareInvoiceId,
        clientName: sql`(SELECT clients.full_name FROM clients WHERE clients.id = ${invoices.clientId})`.as('client_name'),
        clientCompany: sql`(SELECT clients.company FROM clients WHERE clients.id = ${invoices.clientId})`.as('client_company'),
        projectName: sql`(SELECT projects.name FROM projects WHERE projects.id = ${invoices.projectId})`.as('project_name'),
        createdByName: teamUsers.fullName,
      })
      .from(invoices)
      .leftJoin(teamUsers, eq(invoices.createdBy, teamUsers.id))
      .where(whereClause)
      .orderBy(desc(invoices.createdAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ total: count() })
      .from(invoices)
      .where(whereClause),
  ]);

  return {
    invoices: rows,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Fetch a single invoice by ID with line items and payments.
 */
export async function getInvoiceById(id) {
  const isDemo = await isDemoMode();
  const [invoice] = await db
    .select({
      id: invoices.id,
      clientId: invoices.clientId,
      projectId: invoices.projectId,
      milestoneId: invoices.milestoneId,
      squareInvoiceId: invoices.squareInvoiceId,
      squarePaymentUrl: invoices.squarePaymentUrl,
      title: invoices.title,
      description: invoices.description,
      amount: invoices.amount,
      status: invoices.status,
      sentAt: invoices.sentAt,
      viewedAt: invoices.viewedAt,
      paidAt: invoices.paidAt,
      dueDate: invoices.dueDate,
      createdBy: invoices.createdBy,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
      clientName: sql`(SELECT clients.full_name FROM clients WHERE clients.id = ${invoices.clientId})`.as('client_name'),
      clientEmail: sql`(SELECT clients.email FROM clients WHERE clients.id = ${invoices.clientId})`.as('client_email'),
      clientCompany: sql`(SELECT clients.company FROM clients WHERE clients.id = ${invoices.clientId})`.as('client_company'),
      projectName: sql`(SELECT projects.name FROM projects WHERE projects.id = ${invoices.projectId})`.as('project_name'),
      createdByName: teamUsers.fullName,
    })
    .from(invoices)
    .leftJoin(teamUsers, eq(invoices.createdBy, teamUsers.id))
    .where(and(eq(invoices.id, id), eq(invoices.isDemo, isDemo)))
    .limit(1);

  if (!invoice) return null;

  const [lineItemRows, paymentRows] = await Promise.all([
    db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, id))
      .orderBy(invoiceLineItems.sortOrder),
    db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, id))
      .orderBy(desc(payments.paidAt)),
  ]);

  return { ...invoice, lineItems: lineItemRows, payments: paymentRows };
}

/**
 * Fetch invoices for a specific client.
 */
export async function getInvoicesByClientId(clientId) {
  const isDemo = await isDemoMode();
  return db
    .select({
      id: invoices.id,
      title: invoices.title,
      status: invoices.status,
      amount: invoices.amount,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      sentAt: invoices.sentAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(and(eq(invoices.clientId, clientId), eq(invoices.isDemo, isDemo)))
    .orderBy(desc(invoices.createdAt));
}

/**
 * Fetch invoices for a specific project.
 */
export async function getInvoicesByProjectId(projectId) {
  const isDemo = await isDemoMode();
  return db
    .select({
      id: invoices.id,
      title: invoices.title,
      status: invoices.status,
      amount: invoices.amount,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      sentAt: invoices.sentAt,
      createdAt: invoices.createdAt,
      milestoneId: invoices.milestoneId,
    })
    .from(invoices)
    .where(and(eq(invoices.projectId, projectId), eq(invoices.isDemo, isDemo)))
    .orderBy(desc(invoices.createdAt));
}

/**
 * Get invoice summary stats for the dashboard cards.
 */
export async function getInvoiceSummary() {
  const isDemo = await isDemoMode();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [outstandingResult, paidThisMonthResult, overdueResult] = await Promise.all([
    // Total outstanding (sent + viewed + overdue)
    db
      .select({ total: sql`COALESCE(SUM(${invoices.amount}::numeric), 0)`.as('total') })
      .from(invoices)
      .where(and(sql`${invoices.status} IN ('sent', 'viewed', 'overdue')`, eq(invoices.isDemo, isDemo))),
    // Paid this month
    db
      .select({ total: sql`COALESCE(SUM(${invoices.amount}::numeric), 0)`.as('total') })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, 'paid'),
          sql`${invoices.paidAt} >= ${startOfMonth.toISOString()}`,
          eq(invoices.isDemo, isDemo)
        )
      ),
    // Overdue count
    db
      .select({ count: count() })
      .from(invoices)
      .where(and(eq(invoices.status, 'overdue'), eq(invoices.isDemo, isDemo))),
  ]);

  return {
    totalOutstanding: Number(outstandingResult[0]?.total || 0),
    paidThisMonth: Number(paidThisMonthResult[0]?.total || 0),
    overdueCount: Number(overdueResult[0]?.count || 0),
  };
}

/**
 * Get clients dropdown for invoice form.
 */
export async function getClientsForInvoiceDropdown() {
  const isDemo = await isDemoMode();
  return db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      email: clients.email,
      company: clients.company,
    })
    .from(clients)
    .where(eq(clients.isDemo, isDemo))
    .orderBy(clients.fullName);
}

/**
 * Get projects for a specific client (for invoice form dropdown).
 */
export async function getProjectsForClient(clientId) {
  const isDemo = await isDemoMode();
  return db
    .select({
      id: projects.id,
      name: projects.name,
    })
    .from(projects)
    .where(and(eq(projects.clientId, clientId), eq(projects.isDemo, isDemo)))
    .orderBy(desc(projects.createdAt));
}
