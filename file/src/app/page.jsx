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
} from '@/lib/db/queries/dashboard';
import { getPendingFollowUps } from '@/lib/db/queries/follow-ups';
import { getUpcomingRenewals } from '@/lib/db/queries/services';

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

  let metrics, alerts, activity, upcomingMilestones, revenue, leadSources, followUps, unassignedLeads, teamMembersForAssign, upcomingRenewals;
  try {
    [metrics, alerts, activity, upcomingMilestones, revenue, leadSources, followUps, unassignedLeads, teamMembersForAssign, upcomingRenewals] = await Promise.all([
      getMetrics(),
      getAlerts(),
      getRecentActivity(),
      getUpcomingMilestones(),
      getRevenueMetrics(),
      getLeadSourceAnalytics(),
      getPendingFollowUps(teamUser.id),
      getUnassignedLeads(),
      getTeamMembersForAssignment(),
      getUpcomingRenewals(7).catch(() => []),
    ]);
  } catch (err) {
    console.error('[Dashboard] Data fetch error:', err.message, err.stack);
    // Fallback to empty data so the page still renders
    metrics = { totalLeads: 0, totalClients: 0, totalProjects: 0, totalRevenue: 0, activeProjects: 0, openInvoices: 0 };
    alerts = [];
    activity = [];
    upcomingMilestones = [];
    revenue = { monthlyRevenue: [], totalPaid: 0, totalOutstanding: 0 };
    leadSources = [];
    followUps = [];
    unassignedLeads = [];
    teamMembersForAssign = [];
    upcomingRenewals = [];
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
      />
    </MasterLayout>
  );
};

export default Page;
