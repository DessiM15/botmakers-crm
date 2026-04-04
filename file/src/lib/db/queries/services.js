import { db } from '@/lib/db/client';
import { clientServices, clients, projects } from '@/lib/db/schema';
import { eq, and, sql, desc, lte, gte, ilike, or, isNull, isNotNull } from 'drizzle-orm';
import { isDemoMode } from '@/lib/utils/demo';

/**
 * Fetch paginated services with filters.
 */
export async function getServices({
  search = '',
  category = 'all',
  status = 'all',
  type = 'all',
  clientId = null,
  page = 1,
  perPage = 10,
} = {}) {
  const isDemo = await isDemoMode();
  const conditions = [eq(clientServices.isDemo, isDemo)];

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

  if (type === 'internal') {
    conditions.push(isNull(clientServices.clientId));
  } else if (type === 'client') {
    conditions.push(isNotNull(clientServices.clientId));
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
        clientName: sql`COALESCE((SELECT full_name FROM clients WHERE clients.id = ${clientServices.clientId}), 'BotMakers')`.as('client_name'),
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
  const isDemo = await isDemoMode();
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
      clientName: sql`COALESCE((SELECT full_name FROM clients WHERE clients.id = ${clientServices.clientId}), 'BotMakers')`.as('client_name'),
      projectName: sql`(SELECT name FROM projects WHERE projects.id = ${clientServices.projectId})`.as('project_name'),
    })
    .from(clientServices)
    .where(and(eq(clientServices.id, id), eq(clientServices.isDemo, isDemo)))
    .limit(1);

  return service || null;
}

/**
 * Fetch services for a specific client.
 */
export async function getServicesByClientId(clientId) {
  const isDemo = await isDemoMode();
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
    .where(and(eq(clientServices.clientId, clientId), eq(clientServices.isDemo, isDemo)))
    .orderBy(desc(clientServices.createdAt));
}

/**
 * Fetch services for a specific project.
 */
export async function getServicesByProjectId(projectId) {
  const isDemo = await isDemoMode();
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
      clientName: sql`COALESCE((SELECT full_name FROM clients WHERE clients.id = ${clientServices.clientId}), 'BotMakers')`.as('client_name'),
    })
    .from(clientServices)
    .where(and(eq(clientServices.projectId, projectId), eq(clientServices.isDemo, isDemo)))
    .orderBy(desc(clientServices.createdAt));
}

/**
 * Summary stats for the services overview.
 */
export async function getServiceSummary() {
  const isDemo = await isDemoMode();
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'active' OR status = 'expiring_soon' THEN monthly_cost ELSE 0 END), 0) AS total_monthly_cost,
      COALESCE(SUM(CASE WHEN (status = 'active' OR status = 'expiring_soon') AND client_id IS NULL THEN monthly_cost ELSE 0 END), 0) AS internal_monthly_cost,
      COALESCE(SUM(CASE WHEN (status = 'active' OR status = 'expiring_soon') AND client_id IS NOT NULL THEN monthly_cost ELSE 0 END), 0) AS client_monthly_cost,
      COUNT(*) FILTER (WHERE status = 'active') AS active_count,
      COUNT(*) FILTER (WHERE status = 'active' AND client_id IS NULL) AS internal_active_count,
      COUNT(*) FILTER (WHERE status = 'active' AND client_id IS NOT NULL) AS client_active_count,
      COUNT(*) FILTER (WHERE status = 'expiring_soon') AS expiring_count
    FROM client_services
    WHERE is_demo = ${isDemo}
  `);

  const row = result.rows?.[0] || {};
  return {
    totalMonthlyCost: Number(row.total_monthly_cost || 0),
    internalMonthlyCost: Number(row.internal_monthly_cost || 0),
    clientMonthlyCost: Number(row.client_monthly_cost || 0),
    activeCount: Number(row.active_count || 0),
    internalActiveCount: Number(row.internal_active_count || 0),
    clientActiveCount: Number(row.client_active_count || 0),
    expiringCount: Number(row.expiring_count || 0),
  };
}

/**
 * Fetch services with renewal_date within N days.
 */
export async function getUpcomingRenewals(days = 7) {
  const isDemo = await isDemoMode();
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
      clientName: sql`COALESCE((SELECT full_name FROM clients WHERE clients.id = ${clientServices.clientId}), 'BotMakers')`.as('client_name'),
    })
    .from(clientServices)
    .where(
      and(
        lte(clientServices.renewalDate, future.toISOString().split('T')[0]),
        gte(clientServices.renewalDate, now.toISOString().split('T')[0]),
        or(
          eq(clientServices.status, 'active'),
          eq(clientServices.status, 'expiring_soon')
        ),
        eq(clientServices.isDemo, isDemo)
      )
    )
    .orderBy(clientServices.renewalDate);
}

/**
 * Fetch clients for the service form dropdown.
 */
export async function getClientsForServiceDropdown() {
  const isDemo = await isDemoMode();
  return db
    .select({ id: clients.id, fullName: clients.fullName, company: clients.company })
    .from(clients)
    .where(eq(clients.isDemo, isDemo))
    .orderBy(clients.fullName);
}
