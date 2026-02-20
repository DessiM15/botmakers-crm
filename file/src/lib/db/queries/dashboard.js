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

export async function getMetrics() {
  const now = new Date();

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [[thisWeek], [lastWeek], [pipeline], [activeProj], [revenue]] =
    await Promise.all([
      // Leads created this week
      db
        .select({ value: count() })
        .from(leads)
        .where(gte(leads.createdAt, weekAgo)),

      // Leads created last week (for delta)
      db
        .select({ value: count() })
        .from(leads)
        .where(
          and(gte(leads.createdAt, twoWeeksAgo), lt(leads.createdAt, weekAgo))
        ),

      // Pipeline value — proposals linked to leads in stages 5-7
      db
        .select({ value: sum(proposals.totalAmount) })
        .from(proposals)
        .innerJoin(leads, eq(proposals.leadId, leads.id))
        .where(
          and(
            inArray(leads.pipelineStage, [
              'proposal_sent',
              'negotiation',
              'contract_signed',
            ]),
            notInArray(proposals.status, ['declined', 'expired'])
          )
        ),

      // Active projects
      db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.status, 'in_progress')),

      // Revenue this month
      db
        .select({ value: sum(payments.amount) })
        .from(payments)
        .where(gte(payments.paidAt, monthStart)),
    ]);

  return {
    leadsThisWeek: Number(thisWeek?.value ?? 0),
    leadsDelta:
      Number(thisWeek?.value ?? 0) - Number(lastWeek?.value ?? 0),
    pipelineValue: parseFloat(pipeline?.value ?? '0'),
    activeProjects: Number(activeProj?.value ?? 0),
    revenueThisMonth: parseFloat(revenue?.value ?? '0'),
  };
}

export async function getAlerts(staleDays = 7) {
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
          )
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
          eq(projects.status, 'in_progress')
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
          lte(projectQuestions.createdAt, oneDayAgo)
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
        eq(projects.status, 'in_progress')
      )
    )
    .orderBy(asc(projectMilestones.dueDate))
    .limit(limit);
}

export async function getRecentActivity(limit = 15) {
  const activities = await db
    .select()
    .from(activityLog)
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
          ne(invoices.status, 'draft')
        )
      ),
    // Total paid this month
    db
      .select({ value: sum(payments.amount) })
      .from(payments)
      .where(gte(payments.paidAt, monthStart)),
    // Outstanding (sent but not paid)
    db
      .select({ value: sum(invoices.amount) })
      .from(invoices)
      .where(
        inArray(invoices.status, ['sent', 'viewed', 'overdue'])
      ),
    // Total paid last month (for MoM)
    db
      .select({ value: sum(payments.amount) })
      .from(payments)
      .where(
        and(
          gte(payments.paidAt, lastMonthStart),
          lte(payments.paidAt, lastMonthEnd)
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
          notInArray(leads.pipelineStage, ['lost'])
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

export async function getLeadSourceAnalytics() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Count leads by source in last 90 days
  const sourceLeads = await db
    .select({
      source: leads.source,
      total: count(),
    })
    .from(leads)
    .where(gte(leads.createdAt, ninetyDaysAgo))
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
        sql`${leads.convertedToClientId} IS NOT NULL`
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
