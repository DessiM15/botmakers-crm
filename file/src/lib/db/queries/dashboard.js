import { db } from '@/lib/db/client';
import {
  leads,
  proposals,
  projects,
  invoices,
  payments,
  projectMilestones,
  projectQuestions,
  activityLog,
  teamUsers,
  clients,
} from '@/lib/db/schema';
import {
  eq,
  and,
  asc,
  gte,
  lt,
  lte,
  or,
  sql,
  count,
  sum,
  desc,
  inArray,
  notInArray,
  isNull,
  ne,
} from 'drizzle-orm';
import { isDemoMode } from '@/lib/utils/demo';

export async function getMetrics() {
  const isDemo = await isDemoMode();
  const now = new Date();

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const quarterAgo = new Date(now);
  quarterAgo.setDate(quarterAgo.getDate() - 90);

  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [
    [thisWeek], [lastWeek],
    [outProposalSum], [outProposalCount],
    [outInvoiceSum], [outInvoiceCount],
    [activeProj], [revenue],
    [leadsThisMonth], [leadsThisQuarter], [leadsThisYear],
    leadSourceBreakdown,
  ] =
    await Promise.all([
      // Leads created this week
      db
        .select({ value: count() })
        .from(leads)
        .where(and(gte(leads.createdAt, weekAgo), eq(leads.isDemo, isDemo))),

      // Leads created last week (for delta)
      db
        .select({ value: count() })
        .from(leads)
        .where(
          and(gte(leads.createdAt, twoWeeksAgo), lt(leads.createdAt, weekAgo), eq(leads.isDemo, isDemo))
        ),

      // Outstanding proposals — SUM of total_amount for sent/viewed
      db
        .select({ value: sum(proposals.totalAmount) })
        .from(proposals)
        .where(
          and(
            inArray(proposals.status, ['sent', 'viewed']),
            eq(proposals.isDemo, isDemo)
          )
        ),

      // Outstanding proposals — COUNT
      db
        .select({ value: count() })
        .from(proposals)
        .where(
          and(
            inArray(proposals.status, ['sent', 'viewed']),
            eq(proposals.isDemo, isDemo)
          )
        ),

      // Outstanding invoices — SUM of amount for sent/viewed/overdue
      db
        .select({ value: sum(invoices.amount) })
        .from(invoices)
        .where(
          and(
            inArray(invoices.status, ['sent', 'viewed', 'overdue']),
            eq(invoices.isDemo, isDemo)
          )
        ),

      // Outstanding invoices — COUNT
      db
        .select({ value: count() })
        .from(invoices)
        .where(
          and(
            inArray(invoices.status, ['sent', 'viewed', 'overdue']),
            eq(invoices.isDemo, isDemo)
          )
        ),

      // Active projects
      db
        .select({ value: count() })
        .from(projects)
        .where(and(eq(projects.status, 'in_progress'), eq(projects.isDemo, isDemo))),

      // Revenue this month
      db
        .select({ value: sum(payments.amount) })
        .from(payments)
        .where(and(gte(payments.paidAt, monthStart), eq(payments.isDemo, isDemo))),

      // Leads this month
      db
        .select({ value: count() })
        .from(leads)
        .where(and(gte(leads.createdAt, monthAgo), eq(leads.isDemo, isDemo))),

      // Leads this quarter
      db
        .select({ value: count() })
        .from(leads)
        .where(and(gte(leads.createdAt, quarterAgo), eq(leads.isDemo, isDemo))),

      // Leads this year
      db
        .select({ value: count() })
        .from(leads)
        .where(and(gte(leads.createdAt, yearStart), eq(leads.isDemo, isDemo))),

      // Lead source breakdown (this week)
      db
        .select({ source: leads.source, value: count() })
        .from(leads)
        .where(and(gte(leads.createdAt, weekAgo), eq(leads.isDemo, isDemo)))
        .groupBy(leads.source),
    ]);

  return {
    leadsThisWeek: Number(thisWeek?.value ?? 0),
    leadsDelta:
      Number(thisWeek?.value ?? 0) - Number(lastWeek?.value ?? 0),
    leadsThisMonth: Number(leadsThisMonth?.value ?? 0),
    leadsThisQuarter: Number(leadsThisQuarter?.value ?? 0),
    leadsThisYear: Number(leadsThisYear?.value ?? 0),
    leadSourceBreakdown: leadSourceBreakdown.map((r) => ({ source: r.source, count: Number(r.value) })),
    outstandingProposalsAmount: parseFloat(outProposalSum?.value ?? '0'),
    outstandingProposalsCount: Number(outProposalCount?.value ?? 0),
    outstandingInvoicesAmount: parseFloat(outInvoiceSum?.value ?? '0'),
    outstandingInvoicesCount: Number(outInvoiceCount?.value ?? 0),
    activeProjects: Number(activeProj?.value ?? 0),
    revenueThisMonth: parseFloat(revenue?.value ?? '0'),
  };
}

export async function getAlerts(staleDays = 7) {
  const isDemo = await isDemoMode();
  const now = new Date();

  const staleDate = new Date(now);
  staleDate.setDate(staleDate.getDate() - staleDays);

  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const [staleLeads, overdueMilestones, pendingQuestions] = await Promise.all([
    // Stale leads — not contacted in staleDays, still in active pipeline stages
    db
      .select({
        id: leads.id,
        fullName: leads.fullName,
        pipelineStage: leads.pipelineStage,
        lastContactedAt: leads.lastContactedAt,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(
        and(
          notInArray(leads.pipelineStage, [
            'active_client',
            'project_delivered',
            'retention',
          ]),
          isNull(leads.convertedToClientId),
          or(
            and(isNull(leads.lastContactedAt), lte(leads.createdAt, staleDate)),
            lte(leads.lastContactedAt, staleDate)
          ),
          eq(leads.isDemo, isDemo)
        )
      )
      .limit(10),

    // Overdue milestones — past due_date and not completed
    db
      .select({
        id: projectMilestones.id,
        title: projectMilestones.title,
        dueDate: projectMilestones.dueDate,
        projectId: projectMilestones.projectId,
        projectName: projects.name,
      })
      .from(projectMilestones)
      .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
      .where(
        and(
          sql`${projectMilestones.dueDate} < CURRENT_DATE`,
          ne(projectMilestones.status, 'completed'),
          eq(projects.status, 'in_progress'),
          eq(projects.isDemo, isDemo)
        )
      )
      .limit(10),

    // Pending questions older than 24 hours
    db
      .select({
        id: projectQuestions.id,
        questionText: projectQuestions.questionText,
        projectId: projectQuestions.projectId,
        projectName: projects.name,
        createdAt: projectQuestions.createdAt,
      })
      .from(projectQuestions)
      .innerJoin(projects, eq(projectQuestions.projectId, projects.id))
      .where(
        and(
          eq(projectQuestions.status, 'pending'),
          lte(projectQuestions.createdAt, oneDayAgo),
          eq(projects.isDemo, isDemo)
        )
      )
      .limit(10),
  ]);

  return { staleLeads, overdueMilestones, pendingQuestions };
}

/**
 * Upcoming milestones — due within N days, not completed.
 */
export async function getUpcomingMilestones(days = 7, limit = 10) {
  const isDemo = await isDemoMode();
  return db
    .select({
      id: projectMilestones.id,
      title: projectMilestones.title,
      status: projectMilestones.status,
      dueDate: projectMilestones.dueDate,
      projectId: projectMilestones.projectId,
      projectName: projects.name,
    })
    .from(projectMilestones)
    .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
    .where(
      and(
        ne(projectMilestones.status, 'completed'),
        sql`${projectMilestones.dueDate} IS NOT NULL`,
        sql`${projectMilestones.dueDate} <= CURRENT_DATE + interval '${sql.raw(String(days))} days'`,
        eq(projects.status, 'in_progress'),
        eq(projects.isDemo, isDemo)
      )
    )
    .orderBy(asc(projectMilestones.dueDate))
    .limit(limit);
}

export async function getRecentActivity(limit = 50) {
  const isDemo = await isDemoMode();
  const activities = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.isDemo, isDemo))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);

  const actorIds = [
    ...new Set(
      activities
        .filter((a) => a.actorType === 'team' && a.actorId)
        .map((a) => a.actorId)
    ),
  ];

  let actorMap = {};
  if (actorIds.length > 0) {
    const actors = await db
      .select({ id: teamUsers.id, fullName: teamUsers.fullName })
      .from(teamUsers)
      .where(inArray(teamUsers.id, actorIds));
    actorMap = Object.fromEntries(actors.map((a) => [a.id, a.fullName]));
  }

  return activities.map((a) => ({
    ...a,
    actorName:
      a.actorType === 'system'
        ? 'System'
        : actorMap[a.actorId] || 'Unknown',
  }));
}

/**
 * Revenue dashboard metrics.
 */
export async function getRevenueMetrics() {
  const isDemo = await isDemoMode();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const [
    [invoicedThisMonth],
    [paidThisMonth],
    [outstanding],
    [paidLastMonth],
  ] = await Promise.all([
    // Total invoiced this month
    db
      .select({ value: sum(invoices.amount) })
      .from(invoices)
      .where(
        and(
          gte(invoices.createdAt, monthStart),
          ne(invoices.status, 'draft'),
          eq(invoices.isDemo, isDemo)
        )
      ),
    // Total paid this month
    db
      .select({ value: sum(payments.amount) })
      .from(payments)
      .where(and(gte(payments.paidAt, monthStart), eq(payments.isDemo, isDemo))),
    // Outstanding (sent but not paid)
    db
      .select({ value: sum(invoices.amount) })
      .from(invoices)
      .where(
        and(
          inArray(invoices.status, ['sent', 'viewed', 'overdue']),
          eq(invoices.isDemo, isDemo)
        )
      ),
    // Total paid last month (for MoM)
    db
      .select({ value: sum(payments.amount) })
      .from(payments)
      .where(
        and(
          gte(payments.paidAt, lastMonthStart),
          lte(payments.paidAt, lastMonthEnd),
          eq(payments.isDemo, isDemo)
        )
      ),
  ]);

  const paidThisVal = parseFloat(paidThisMonth?.value ?? '0');
  const paidLastVal = parseFloat(paidLastMonth?.value ?? '0');
  const momChange = paidLastVal > 0
    ? Math.round(((paidThisVal - paidLastVal) / paidLastVal) * 100)
    : paidThisVal > 0 ? 100 : 0;

  return {
    invoicedThisMonth: parseFloat(invoicedThisMonth?.value ?? '0'),
    paidThisMonth: paidThisVal,
    outstanding: parseFloat(outstanding?.value ?? '0'),
    momChange,
  };
}

/**
 * Lead source analytics — last 90 days.
 */
/**
 * Unassigned leads — for the dashboard quick-assign widget.
 */
export async function getUnassignedLeads(limit = 10) {
  try {
    const isDemo = await isDemoMode();
    return await db
      .select({
        id: leads.id,
        fullName: leads.fullName,
        email: leads.email,
        companyName: leads.companyName,
        source: leads.source,
        createdAt: leads.createdAt,
        pipelineStage: leads.pipelineStage,
        score: leads.score,
      })
      .from(leads)
      .where(
        and(
          isNull(leads.assignedTo),
          notInArray(leads.pipelineStage, ['lost']),
          eq(leads.isDemo, isDemo)
        )
      )
      .orderBy(desc(leads.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

/**
 * Active team members for assignment dropdowns.
 */
export async function getTeamMembersForAssignment() {
  try {
    return await db
      .select({
        id: teamUsers.id,
        fullName: teamUsers.fullName,
        email: teamUsers.email,
      })
      .from(teamUsers)
      .where(eq(teamUsers.isActive, true));
  } catch {
    return [];
  }
}

/**
 * Monthly revenue for the last 12 months — invoiced vs collected.
 */
export async function getMonthlyRevenue() {
  const isDemo = await isDemoMode();
  const rows = await db.execute(sql`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', NOW()) - interval '11 months',
        date_trunc('month', NOW()),
        '1 month'
      )::date AS month_start
    )
    SELECT
      to_char(m.month_start, 'Mon') AS month,
      COALESCE((
        SELECT SUM(i.amount::numeric)
        FROM invoices i
        WHERE i.status != 'draft'
          AND date_trunc('month', i.created_at) = m.month_start
          AND i.is_demo = ${isDemo}
      ), 0)::int AS invoiced,
      COALESCE((
        SELECT SUM(p2.amount::numeric)
        FROM payments p2
        WHERE date_trunc('month', p2.paid_at) = m.month_start
          AND p2.is_demo = ${isDemo}
      ), 0)::int AS collected
    FROM months m
    ORDER BY m.month_start ASC
  `);

  return rows.rows || rows;
}

export async function getLeadSourceAnalytics() {
  const isDemo = await isDemoMode();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Count leads by source in last 90 days
  const sourceLeads = await db
    .select({
      source: leads.source,
      total: count(),
    })
    .from(leads)
    .where(and(gte(leads.createdAt, ninetyDaysAgo), eq(leads.isDemo, isDemo)))
    .groupBy(leads.source);

  // Count converted leads by source in last 90 days
  const sourceConverted = await db
    .select({
      source: leads.source,
      converted: count(),
    })
    .from(leads)
    .where(
      and(
        gte(leads.createdAt, ninetyDaysAgo),
        sql`${leads.convertedToClientId} IS NOT NULL`,
        eq(leads.isDemo, isDemo)
      )
    )
    .groupBy(leads.source);

  const convertedMap = Object.fromEntries(
    sourceConverted.map((s) => [s.source, Number(s.converted)])
  );

  return sourceLeads.map((s) => ({
    source: s.source,
    total: Number(s.total),
    converted: convertedMap[s.source] || 0,
    conversionRate:
      Number(s.total) > 0
        ? Math.round((( convertedMap[s.source] || 0) / Number(s.total)) * 100)
        : 0,
  }));
}

/**
 * Draft proposals grouped by creator — for "Contracts for Review" dashboard widget.
 */
export async function getDraftProposalsByCreator() {
  const isDemo = await isDemoMode();

  const rows = await db.execute(sql`
    SELECT
      p.created_by,
      tu.full_name AS creator_name,
      COUNT(*)::int AS draft_count,
      json_agg(json_build_object('id', p.id, 'title', p.title)) AS proposals
    FROM proposals p
    INNER JOIN team_users tu ON tu.id = p.created_by
    WHERE p.status = 'draft'
      AND p.is_demo = ${isDemo}
    GROUP BY p.created_by, tu.full_name
    ORDER BY draft_count DESC
  `);

  return rows.rows || rows;
}
