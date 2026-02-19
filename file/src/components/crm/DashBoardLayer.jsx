import Link from 'next/link';
import { Icon } from '@iconify/react';
import MetricCards from './MetricCards';
import AlertsPanel from './AlertsPanel';
import ActivityFeed from './ActivityFeed';

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

const DashBoardLayer = ({ teamUser, metrics, alerts, activity }) => {
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

      {/* Metric Cards */}
      <MetricCards metrics={metrics} />

      {/* Alerts + Activity Feed + Quick Actions */}
      <section className="row gy-4 mt-1">
        <div className="col-xxl-4 col-lg-6">
          <AlertsPanel alerts={alerts} />
        </div>

        <div className="col-xxl-5 col-lg-6">
          <ActivityFeed activity={activity} />
        </div>

        <div className="col-xxl-3 col-lg-12">
          <div className="card h-100">
            <div className="card-header border-bottom">
              <h6 className="text-lg fw-semibold mb-0">Quick Actions</h6>
            </div>
            <div className="card-body d-flex flex-column gap-12">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="btn btn-outline-primary-600 text-white d-flex align-items-center gap-8 text-start"
                >
                  <Icon icon={action.icon} className="text-xl" />
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default DashBoardLayer;
