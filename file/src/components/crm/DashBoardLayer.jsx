import Link from 'next/link';
import { Icon } from '@iconify/react';
import MetricCards from './MetricCards';
import AlertsPanel from './AlertsPanel';
import UpcomingTasks from './UpcomingTasks';
import ActivityFeed from './ActivityFeed';
import RevenueWidget from './RevenueWidget';
import LeadSourceAnalytics from './LeadSourceAnalytics';
import FollowUpQueue from './FollowUpQueue';
import NewLeadsAssign from './NewLeadsAssign';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const quickActions = [
  {
    label: 'View Leads',
    href: '/leads',
    icon: 'solar:users-group-two-rounded-bold',
  },
  {
    label: 'New Project',
    href: '/projects/new',
    icon: 'solar:add-circle-bold',
  },
  { label: 'Referrals', href: '/referrals', icon: 'solar:share-bold' },
  { label: 'Projects', href: '/projects', icon: 'solar:code-bold' },
];

const DashBoardLayer = ({
  teamUser,
  metrics,
  alerts,
  activity,
  upcomingMilestones = [],
  revenue,
  leadSources = [],
  followUps = [],
  unassignedLeads = [],
  teamMembersForAssign = [],
}) => {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const firstName = teamUser.fullName.split(' ')[0];

  return (
    <>
      {/* Greeting */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-24">
        <div>
          <h6 className="fw-semibold mb-0">
            {getGreeting()}, {firstName}
          </h6>
          <span className="text-secondary-light text-sm">{today}</span>
        </div>
      </div>

      {/* Revenue + Lead Sources */}
      <section className="row gy-4">
        <div className="col-xxl-7 col-lg-6">
          <RevenueWidget revenue={revenue} />
        </div>
        <div className="col-xxl-5 col-lg-6">
          <LeadSourceAnalytics sources={leadSources} />
        </div>
      </section>

      {/* Metric Cards */}
      <div className="mt-4">
        <MetricCards metrics={metrics} />
      </div>

      {/* Unassigned Leads + Follow-Up Queue */}
      <section className="row gy-4 mt-1">
        <div className="col-xxl-6 col-lg-6">
          <NewLeadsAssign leads={unassignedLeads} teamMembers={teamMembersForAssign} />
        </div>
        <div className="col-xxl-6 col-lg-6">
          <FollowUpQueue followUps={followUps} />
        </div>
      </section>

      {/* Upcoming Tasks + Alerts */}
      <section className="row gy-4 mt-1">
        <div className="col-xxl-6 col-lg-6">
          <UpcomingTasks milestones={upcomingMilestones} />
        </div>

        <div className="col-xxl-6 col-lg-12">
          <AlertsPanel alerts={alerts} />
        </div>
      </section>

      {/* Activity Feed */}
      <section className="row gy-4 mt-1">
        <div className="col-12">
          <ActivityFeed activity={activity} />
        </div>
      </section>
    </>
  );
};

export default DashBoardLayer;
