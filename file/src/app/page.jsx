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
} from '@/lib/db/queries/dashboard';

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

  const [metrics, alerts, activity, upcomingMilestones] = await Promise.all([
    getMetrics(),
    getAlerts(),
    getRecentActivity(),
    getUpcomingMilestones(),
  ]);

  return (
    <MasterLayout>
      <DashBoardLayer
        teamUser={teamUser}
        metrics={metrics}
        alerts={alerts}
        activity={activity}
        upcomingMilestones={upcomingMilestones}
      />
    </MasterLayout>
  );
};

export default Page;
