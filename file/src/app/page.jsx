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
  getDraftProposalsByCreator,
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

  let metrics, alerts, activity, upcomingMilestones, revenue, leadSources, followUps, unassignedLeads, teamMembersForAssign, upcomingRenewals, todaysMeetings, monthlyRevenue, draftProposals;
  try {
    [metrics, alerts, activity, upcomingMilestones, revenue, leadSources, followUps, unassignedLeads, teamMembersForAssign, upcomingRenewals, todaysMeetings, monthlyRevenue, draftProposals] = await Promise.all([
      getMetrics().catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('[Dashboard] getMetrics failed:', err);
        return { leadsThisWeek: 0, leadsDelta: 0, leadsThisMonth: 0, leadsThisQuarter: 0, leadsThisYear: 0, leadSourceBreakdown: [], outstandingProposalsAmount: 0, outstandingProposalsCount: 0, outstandingInvoicesAmount: 0, outstandingInvoicesCount: 0, activeProjects: 0, revenueThisMonth: 0, _error: true };
      }),
      getAlerts().catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('[Dashboard] getAlerts failed:', err);
        return { staleLeads: [], overdueMilestones: [], pendingQuestions: [], _error: true };
      }),
      getRecentActivity().catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('[Dashboard] getRecentActivity failed:', err);
        return [];
      }),
      getUpcomingMilestones().catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('[Dashboard] getUpcomingMilestones failed:', err);
        return [];
      }),
      getRevenueMetrics().catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('[Dashboard] getRevenueMetrics failed:', err);
        return { invoicedThisMonth: 0, paidThisMonth: 0, outstanding: 0, momChange: 0, _error: true };
      }),
      getLeadSourceAnalytics().catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('[Dashboard] getLeadSourceAnalytics failed:', err);
        return [];
      }),
      getPendingFollowUps(teamUser.id).catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('[Dashboard] getPendingFollowUps failed:', err);
        return [];
      }),
      getUnassignedLeads(),
      getTeamMembersForAssignment(),
      getUpcomingRenewals(7).catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('[Dashboard] getUpcomingRenewals failed:', err);
        return [];
      }),
      getTodaysMeetings(teamUser.id).catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('[Dashboard] getTodaysMeetings failed:', err);
        return [];
      }),
      getMonthlyRevenue().catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('[Dashboard] getMonthlyRevenue failed:', err);
        return [];
      }),
      getDraftProposalsByCreator().catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('[Dashboard] getDraftProposalsByCreator failed:', err);
        return [];
      }),
    ]);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[Dashboard] Data fetch error:', err.message, err.stack);
    // Fallback to empty data so the page still renders
    metrics = { leadsThisWeek: 0, leadsDelta: 0, leadsThisMonth: 0, leadsThisQuarter: 0, leadsThisYear: 0, leadSourceBreakdown: [], outstandingProposalsAmount: 0, outstandingProposalsCount: 0, outstandingInvoicesAmount: 0, outstandingInvoicesCount: 0, activeProjects: 0, revenueThisMonth: 0 };
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
    draftProposals = [];
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
        draftProposals={draftProposals}
      />
    </MasterLayout>
  );
};

export default Page;
