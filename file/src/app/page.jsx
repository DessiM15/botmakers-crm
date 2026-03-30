import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import DashBoardLayer from '@/components/crm/DashBoardLayer';
import { requireTeam } from '@/lib/auth/helpers';
import {
  getMetrics,
  getAlerts,
  getRecentActivity,
  getUpcomingMilestones,
  getRevenueMetrics,
  getLeadSourceAnalytics,
  getUnassignedLeads,
  getTeamMembersForAssignment,
  getMonthlyRevenue,
} from '@/lib/db/queries/dashboard';
import { getPendingFollowUps } from '@/lib/db/queries/follow-ups';
import { getUpcomingRenewals } from '@/lib/db/queries/services';
import { getTodaysMeetings } from '@/lib/db/queries/meetings';

export const metadata = {
  title: 'Dashboard — Botmakers CRM',
};

const Page = async () => {
  const cookieStore = await cookies();

  let teamUser;
  try {
    const result = await requireTeam(cookieStore);
    teamUser = result.teamUser;
  } catch {
    redirect('/sign-in');
  }

  let metrics, alerts, activity, upcomingMilestones, revenue, leadSources, followUps, unassignedLeads, teamMembersForAssign, upcomingRenewals, todaysMeetings, monthlyRevenue;
  try {
    [metrics, alerts, activity, upcomingMilestones, revenue, leadSources, followUps, unassignedLeads, teamMembersForAssign, upcomingRenewals, todaysMeetings, monthlyRevenue] = await Promise.all([
      getMetrics().catch(() => ({ leadsThisWeek: 0, leadsDelta: 0, pipelineValue: 0, activeProjects: 0, revenueThisMonth: 0 })),
      getAlerts().catch(() => ({ staleLeads: [], overdueMilestones: [], pendingQuestions: [] })),
      getRecentActivity().catch(() => []),
      getUpcomingMilestones().catch(() => []),
      getRevenueMetrics().catch(() => ({ invoicedThisMonth: 0, paidThisMonth: 0, outstanding: 0, momChange: 0 })),
      getLeadSourceAnalytics().catch(() => []),
      getPendingFollowUps(teamUser.id).catch(() => []),
      getUnassignedLeads(),
      getTeamMembersForAssignment(),
      getUpcomingRenewals(7).catch(() => []),
      getTodaysMeetings().catch(() => []),
      getMonthlyRevenue().catch(() => []),
    ]);
  } catch (err) {
    console.error('[Dashboard] Data fetch error:', err.message, err.stack);
    // Fallback to empty data so the page still renders
    metrics = { leadsThisWeek: 0, leadsDelta: 0, pipelineValue: 0, activeProjects: 0, revenueThisMonth: 0 };
    alerts = { staleLeads: [], overdueMilestones: [], pendingQuestions: [] };
    activity = [];
    upcomingMilestones = [];
    revenue = { invoicedThisMonth: 0, paidThisMonth: 0, outstanding: 0, momChange: 0 };
    leadSources = [];
    followUps = [];
    unassignedLeads = [];
    teamMembersForAssign = [];
    upcomingRenewals = [];
    todaysMeetings = [];
    monthlyRevenue = [];
  }

  return (
    <MasterLayout>
      <DashBoardLayer
        teamUser={teamUser}
        metrics={metrics}
        alerts={alerts}
        activity={activity}
        upcomingMilestones={upcomingMilestones}
        revenue={revenue}
        leadSources={leadSources}
        followUps={followUps}
        unassignedLeads={unassignedLeads}
        teamMembersForAssign={teamMembersForAssign}
        upcomingRenewals={upcomingRenewals}
        todaysMeetings={todaysMeetings}
        monthlyRevenue={monthlyRevenue}
      />
    </MasterLayout>
  );
};

export default Page;
