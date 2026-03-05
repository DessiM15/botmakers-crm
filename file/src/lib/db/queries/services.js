import { db } from '@/lib/db/client';
import { clientServices, clients, projects } from '@/lib/db/schema';
import { eq, and, sql, desc, lte, gte, ilike, or } from 'drizzle-orm';

/**
 * Fetch paginated services with filters.
 */
export async function getServices({
  search = '',
  category = 'all',
  status = 'all',
  clientId = null,
  page = 1,
  perPage = 10,
} = {}) {
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(clientServices.serviceName, `%${search}%`),
        ilike(clientServices.provider, `%${search}%`),
        ilike(clientServices.accountIdentifier, `%${search}%`)
      )
    );
  }

  if (category !== 'all') {
    conditions.push(eq(clientServices.category, category));
  }

  if (status !== 'all') {
    conditions.push(eq(clientServices.status, status));
  }

  if (clientId) {
    conditions.push(eq(clientServices.clientId, clientId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * perPage;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: clientServices.id,
        clientId: clientServices.clientId,
        projectId: clientServices.projectId,
        serviceName: clientServices.serviceName,
        provider: clientServices.provider,
        category: clientServices.category,
        monthlyCost: clientServices.monthlyCost,
        billingCycle: clientServices.billingCycle,
        renewalDate: clientServices.renewalDate,
        status: clientServices.status,
        loginUrl: clientServices.loginUrl,
        accountIdentifier: clientServices.accountIdentifier,
        createdAt: clientServices.createdAt,
        clientName: sql`(SELECT full_name FROM clients WHERE clients.id = ${clientServices.clientId})`.as('client_name'),
        projectName: sql`(SELECT name FROM projects WHERE projects.id = ${clientServices.projectId})`.as('project_name'),
      })
      .from(clientServices)
      .where(whereClause)
      .orderBy(desc(clientServices.createdAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ count: sql`COUNT(*)` })
      .from(clientServices)
      .where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    services: rows,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Fetch a single service by ID.
 */
export async function getServiceById(id) {
  const [service] = await db
    .select({
      id: clientServices.id,
      clientId: clientServices.clientId,
      projectId: clientServices.projectId,
      serviceName: clientServices.serviceName,
      provider: clientServices.provider,
      category: clientServices.category,
      monthlyCost: clientServices.monthlyCost,
      billingCycle: clientServices.billingCycle,
      renewalDate: clientServices.renewalDate,
      status: clientServices.status,
      loginUrl: clientServices.loginUrl,
      credentialsVaultUrl: clientServices.credentialsVaultUrl,
      accountIdentifier: clientServices.accountIdentifier,
      notes: clientServices.notes,
      createdAt: clientServices.createdAt,
      updatedAt: clientServices.updatedAt,
      clientName: sql`(SELECT full_name FROM clients WHERE clients.id = ${clientServices.clientId})`.as('client_name'),
      projectName: sql`(SELECT name FROM projects WHERE projects.id = ${clientServices.projectId})`.as('project_name'),
    })
    .from(clientServices)
    .where(eq(clientServices.id, id))
    .limit(1);

  return service || null;
}

/**
 * Fetch services for a specific client.
 */
export async function getServicesByClientId(clientId) {
  return db
    .select({
      id: clientServices.id,
      serviceName: clientServices.serviceName,
      provider: clientServices.provider,
      category: clientServices.category,
      monthlyCost: clientServices.monthlyCost,
      billingCycle: clientServices.billingCycle,
      renewalDate: clientServices.renewalDate,
      status: clientServices.status,
      loginUrl: clientServices.loginUrl,
      accountIdentifier: clientServices.accountIdentifier,
      createdAt: clientServices.createdAt,
      projectName: sql`(SELECT name FROM projects WHERE projects.id = ${clientServices.projectId})`.as('project_name'),
    })
    .from(clientServices)
    .where(eq(clientServices.clientId, clientId))
    .orderBy(desc(clientServices.createdAt));
}

/**
 * Fetch services for a specific project.
 */
export async function getServicesByProjectId(projectId) {
  return db
    .select({
      id: clientServices.id,
      serviceName: clientServices.serviceName,
      provider: clientServices.provider,
      category: clientServices.category,
      monthlyCost: clientServices.monthlyCost,
      billingCycle: clientServices.billingCycle,
      renewalDate: clientServices.renewalDate,
      status: clientServices.status,
      loginUrl: clientServices.loginUrl,
      accountIdentifier: clientServices.accountIdentifier,
      createdAt: clientServices.createdAt,
      clientName: sql`(SELECT full_name FROM clients WHERE clients.id = ${clientServices.clientId})`.as('client_name'),
    })
    .from(clientServices)
    .where(eq(clientServices.projectId, projectId))
    .orderBy(desc(clientServices.createdAt));
}

/**
 * Summary stats for the services overview.
 */
export async function getServiceSummary() {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'active' OR status = 'expiring_soon' THEN monthly_cost ELSE 0 END), 0) AS total_monthly_cost,
      COUNT(*) FILTER (WHERE status = 'active') AS active_count,
      COUNT(*) FILTER (WHERE status = 'expiring_soon') AS expiring_count
    FROM client_services
  `);

  const row = result.rows?.[0] || {};
  return {
    totalMonthlyCost: Number(row.total_monthly_cost || 0),
    activeCount: Number(row.active_count || 0),
    expiringCount: Number(row.expiring_count || 0),
  };
}

/**
 * Fetch services with renewal_date within N days.
 */
export async function getUpcomingRenewals(days = 7) {
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);

  return db
    .select({
      id: clientServices.id,
      serviceName: clientServices.serviceName,
      provider: clientServices.provider,
      monthlyCost: clientServices.monthlyCost,
      renewalDate: clientServices.renewalDate,
      status: clientServices.status,
      clientId: clientServices.clientId,
      clientName: sql`(SELECT full_name FROM clients WHERE clients.id = ${clientServices.clientId})`.as('client_name'),
    })
    .from(clientServices)
    .where(
      and(
        lte(clientServices.renewalDate, future.toISOString().split('T')[0]),
        gte(clientServices.renewalDate, now.toISOString().split('T')[0]),
        or(
          eq(clientServices.status, 'active'),
          eq(clientServices.status, 'expiring_soon')
        )
      )
    )
    .orderBy(clientServices.renewalDate);
}

/**
 * Fetch clients for the service form dropdown.
 */
export async function getClientsForServiceDropdown() {
  return db
    .select({ id: clients.id, fullName: clients.fullName, company: clients.company })
    .from(clients)
    .orderBy(clients.fullName);
}
