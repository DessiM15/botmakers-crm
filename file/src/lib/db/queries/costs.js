import { db } from '@/lib/db/client';
import {
  costEntries,
  clients,
  projects,
  payments,
  invoices,
  teamUsers,
} from '@/lib/db/schema';
import { eq, desc, and, count, sql, ilike, or, sum, between } from 'drizzle-orm';

/**
 * Fetch paginated, filterable cost entries.
 */
export async function getCostEntries({
  search = '',
  source = 'all',
  projectId = null,
  clientId = null,
  periodFrom = null,
  periodTo = null,
  page = 1,
  perPage = 25,
} = {}) {
  const conditions = [];

  if (source !== 'all') {
    conditions.push(eq(costEntries.source, source));
  }

  if (projectId) {
    conditions.push(eq(costEntries.projectId, projectId));
  }

  if (clientId) {
    conditions.push(eq(costEntries.clientId, clientId));
  }

  if (periodFrom) {
    conditions.push(sql`${costEntries.periodStart} >= ${periodFrom}`);
  }

  if (periodTo) {
    conditions.push(sql`${costEntries.periodEnd} <= ${periodTo}`);
  }

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(costEntries.provider, term),
        ilike(costEntries.description, term)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: costEntries.id,
        clientId: costEntries.clientId,
        projectId: costEntries.projectId,
        serviceId: costEntries.serviceId,
        source: costEntries.source,
        provider: costEntries.provider,
        description: costEntries.description,
        amount: costEntries.amount,
        periodStart: costEntries.periodStart,
        periodEnd: costEntries.periodEnd,
        externalId: costEntries.externalId,
        createdAt: costEntries.createdAt,
        clientName: clients.fullName,
        projectName: projects.name,
      })
      .from(costEntries)
      .leftJoin(clients, eq(costEntries.clientId, clients.id))
      .leftJoin(projects, eq(costEntries.projectId, projects.id))
      .where(where)
      .orderBy(desc(costEntries.periodStart), desc(costEntries.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ total: count() })
      .from(costEntries)
      .where(where),
  ]);

  return { items, total, page, perPage };
}

/**
 * Get all costs for a specific project.
 */
export async function getCostsByProjectId(projectId) {
  return db
    .select({
      id: costEntries.id,
      source: costEntries.source,
      provider: costEntries.provider,
      description: costEntries.description,
      amount: costEntries.amount,
      periodStart: costEntries.periodStart,
      periodEnd: costEntries.periodEnd,
      externalId: costEntries.externalId,
      createdAt: costEntries.createdAt,
    })
    .from(costEntries)
    .where(eq(costEntries.projectId, projectId))
    .orderBy(desc(costEntries.periodStart));
}

/**
 * Get all costs for a specific client.
 */
export async function getCostsByClientId(clientId) {
  return db
    .select({
      id: costEntries.id,
      projectId: costEntries.projectId,
      source: costEntries.source,
      provider: costEntries.provider,
      description: costEntries.description,
      amount: costEntries.amount,
      periodStart: costEntries.periodStart,
      periodEnd: costEntries.periodEnd,
      externalId: costEntries.externalId,
      createdAt: costEntries.createdAt,
      projectName: projects.name,
    })
    .from(costEntries)
    .leftJoin(projects, eq(costEntries.projectId, projects.id))
    .where(eq(costEntries.clientId, clientId))
    .orderBy(desc(costEntries.periodStart));
}

/**
 * Get overall cost summary.
 */
export async function getCostSummary(startDate = null, endDate = null) {
  const conditions = [];
  if (startDate) {
    conditions.push(sql`${costEntries.periodStart} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${costEntries.periodEnd} <= ${endDate}`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ total: sum(costEntries.amount) })
    .from(costEntries)
    .where(where);

  const byProvider = await db
    .select({
      provider: costEntries.provider,
      total: sum(costEntries.amount),
      count: count(),
    })
    .from(costEntries)
    .where(where)
    .groupBy(costEntries.provider)
    .orderBy(sql`SUM(${costEntries.amount}) DESC`);

  return {
    totalCosts: Number(totalResult?.total) || 0,
    byProvider: byProvider.map((row) => ({
      provider: row.provider,
      total: Number(row.total) || 0,
      count: Number(row.count) || 0,
    })),
  };
}

/**
 * Calculate P&L for a specific project.
 */
export async function getProjectPnL(projectId) {
  const [revenueResult] = await db
    .select({ total: sum(payments.amount) })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(eq(invoices.projectId, projectId));

  const [costResult] = await db
    .select({ total: sum(costEntries.amount) })
    .from(costEntries)
    .where(eq(costEntries.projectId, projectId));

  const revenue = Number(revenueResult?.total) || 0;
  const costs = Number(costResult?.total) || 0;
  const profit = revenue - costs;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return { revenue, costs, profit, margin };
}

/**
 * Calculate P&L for a specific client.
 */
export async function getClientPnL(clientId) {
  const [revenueResult] = await db
    .select({ total: sum(payments.amount) })
    .from(payments)
    .where(eq(payments.clientId, clientId));

  const [costResult] = await db
    .select({ total: sum(costEntries.amount) })
    .from(costEntries)
    .where(eq(costEntries.clientId, clientId));

  const revenue = Number(revenueResult?.total) || 0;
  const costs = Number(costResult?.total) || 0;
  const profit = revenue - costs;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return { revenue, costs, profit, margin };
}

/**
 * Calculate global P&L.
 */
export async function getGlobalPnL(startDate = null, endDate = null) {
  const revConditions = [];
  const costConditions = [];

  if (startDate) {
    revConditions.push(sql`${payments.paidAt} >= ${startDate}::timestamptz`);
    costConditions.push(sql`${costEntries.periodStart} >= ${startDate}`);
  }
  if (endDate) {
    revConditions.push(sql`${payments.paidAt} <= ${endDate}::timestamptz`);
    costConditions.push(sql`${costEntries.periodEnd} <= ${endDate}`);
  }

  const [revenueResult] = await db
    .select({ total: sum(payments.amount) })
    .from(payments)
    .where(revConditions.length > 0 ? and(...revConditions) : undefined);

  const [costResult] = await db
    .select({ total: sum(costEntries.amount) })
    .from(costEntries)
    .where(costConditions.length > 0 ? and(...costConditions) : undefined);

  const revenue = Number(revenueResult?.total) || 0;
  const costs = Number(costResult?.total) || 0;
  const profit = revenue - costs;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return { revenue, costs, profit, margin };
}

/**
 * Get 12-month P&L trend.
 */
export async function getMonthlyPnLTrend(projectId = null, clientId = null) {
  const revenueQuery = sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', paid_at), 'YYYY-MM') as month,
      COALESCE(SUM(p.amount::numeric), 0) as revenue
    FROM payments p
    ${projectId ? sql`INNER JOIN invoices i ON p.invoice_id = i.id` : sql``}
    WHERE paid_at >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
    ${projectId ? sql`AND i.project_id = ${projectId}` : sql``}
    ${clientId ? sql`AND p.client_id = ${clientId}` : sql``}
    GROUP BY DATE_TRUNC('month', paid_at)
    ORDER BY month
  `;

  const costQuery = sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', period_start), 'YYYY-MM') as month,
      COALESCE(SUM(amount::numeric), 0) as costs
    FROM cost_entries
    WHERE period_start >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
    ${projectId ? sql`AND project_id = ${projectId}` : sql``}
    ${clientId ? sql`AND client_id = ${clientId}` : sql``}
    GROUP BY DATE_TRUNC('month', period_start)
    ORDER BY month
  `;

  const [revenueRows, costRows] = await Promise.all([
    db.execute(revenueQuery),
    db.execute(costQuery),
  ]);

  // Build 12-month array
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7)); // YYYY-MM
  }

  const revenueMap = {};
  (revenueRows.rows || []).forEach((r) => {
    revenueMap[r.month] = Number(r.revenue) || 0;
  });

  const costMap = {};
  (costRows.rows || []).forEach((r) => {
    costMap[r.month] = Number(r.costs) || 0;
  });

  return months.map((month) => {
    const revenue = revenueMap[month] || 0;
    const costs = costMap[month] || 0;
    return {
      month,
      revenue,
      costs,
      profit: revenue - costs,
    };
  });
}

/**
 * Get cost breakdown by provider (for donut chart).
 */
export async function getCostBreakdownByProvider(projectId = null, clientId = null) {
  const conditions = [];
  if (projectId) conditions.push(eq(costEntries.projectId, projectId));
  if (clientId) conditions.push(eq(costEntries.clientId, clientId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      provider: costEntries.provider,
      total: sum(costEntries.amount),
    })
    .from(costEntries)
    .where(where)
    .groupBy(costEntries.provider)
    .orderBy(sql`SUM(${costEntries.amount}) DESC`);

  return rows.map((r) => ({
    provider: r.provider,
    total: Number(r.total) || 0,
  }));
}

/**
 * Get a single cost entry by ID.
 */
export async function getCostEntryById(id) {
  const [entry] = await db
    .select({
      id: costEntries.id,
      clientId: costEntries.clientId,
      projectId: costEntries.projectId,
      serviceId: costEntries.serviceId,
      source: costEntries.source,
      provider: costEntries.provider,
      description: costEntries.description,
      amount: costEntries.amount,
      periodStart: costEntries.periodStart,
      periodEnd: costEntries.periodEnd,
      externalId: costEntries.externalId,
      metadata: costEntries.metadata,
      createdBy: costEntries.createdBy,
      createdAt: costEntries.createdAt,
      clientName: clients.fullName,
      projectName: projects.name,
    })
    .from(costEntries)
    .leftJoin(clients, eq(costEntries.clientId, clients.id))
    .leftJoin(projects, eq(costEntries.projectId, projects.id))
    .where(eq(costEntries.id, id))
    .limit(1);

  return entry || null;
}

/**
 * Get clients dropdown for cost form.
 */
export async function getClientsForCostDropdown() {
  return db
    .select({ id: clients.id, fullName: clients.fullName, company: clients.company })
    .from(clients)
    .orderBy(clients.fullName);
}

/**
 * Get projects dropdown for cost form (optionally filtered by client).
 */
export async function getProjectsForCostDropdown(clientId = null) {
  const conditions = [];
  if (clientId) conditions.push(eq(projects.clientId, clientId));

  return db
    .select({ id: projects.id, name: projects.name, clientId: projects.clientId })
    .from(projects)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(projects.name);
}
