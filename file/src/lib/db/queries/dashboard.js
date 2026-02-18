import { db } from '@/lib/db/client';
import {
  leads,
  proposals,
  projects,
  payments,
  projectMilestones,
  projectQuestions,
  activityLog,
  teamUsers,
} from '@/lib/db/schema';
import {
  eq,
  and,
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
