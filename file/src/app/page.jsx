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
} from '@/lib/db/queries/dashboard';
import { getPendingFollowUps } from '@/lib/db/queries/follow-ups';

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

  const [metrics, alerts, activity, upcomingMilestones, revenue, leadSources, followUps] = await Promise.all([
    getMetrics(),
    getAlerts(),
    getRecentActivity(),
    getUpcomingMilestones(),
    getRevenueMetrics(),
    getLeadSourceAnalytics(),
    getPendingFollowUps(teamUser.id),
  ]);

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
      />
    </MasterLayout>
  );
};

export default Page;
