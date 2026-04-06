import Link from 'next/link';
import { Icon } from '@iconify/react';
import MetricCards from './MetricCards';
import AlertsPanel from './AlertsPanel';
import UpcomingTasks from './UpcomingTasks';
import ActivityFeed from './ActivityFeed';
import RevenueWidget from './RevenueWidget';
// LeadSourceAnalytics removed from dashboard — data is now in the Leads metric card
import FollowUpQueue from './FollowUpQueue';
import NewLeadsAssign from './NewLeadsAssign';
import TodaySchedule from './TodaySchedule';
import RevenueChart from './RevenueChart';
import LeadFunnelChart from './LeadFunnelChart';

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
  upcomingRenewals = [],
  todaysMeetings = [],
  monthlyRevenue = [],
  draftProposals = [],
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

      {/* Revenue */}
      <section className="row gy-4 mt-24">
        <div className="col-12">
          <RevenueWidget revenue={revenue} />
        </div>
      </section>

      {/* Metric Cards */}
      <div className="mt-24">
        <MetricCards metrics={metrics} />
      </div>

      {/* Charts: Revenue Trend + Lead Pipeline */}
      <section className="row gy-4 mt-24">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Revenue Trend</h6>
            </div>
            <div className="card-body">
              <RevenueChart monthlyRevenue={monthlyRevenue} />
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Lead Pipeline</h6>
            </div>
            <div className="card-body">
              <LeadFunnelChart />
            </div>
          </div>
        </div>
      </section>

      {/* Unassigned Leads + Follow-Up Queue */}
      <section className="row gy-4 mt-24">
        <div className="col-xxl-6 col-lg-6">
          <NewLeadsAssign leads={unassignedLeads} teamMembers={teamMembersForAssign} />
        </div>
        <div className="col-xxl-6 col-lg-6">
          <FollowUpQueue followUps={followUps} />
        </div>
      </section>

      {/* Upcoming Tasks + Today's Schedule + Alerts */}
      <section className="row gy-4 mt-24">
        <div className="col-xxl-4 col-lg-6">
          <UpcomingTasks milestones={upcomingMilestones} />
        </div>
        <div className="col-xxl-4 col-lg-6">
          <TodaySchedule meetings={todaysMeetings} upcomingMilestones={upcomingMilestones} />
        </div>
        <div className="col-xxl-4 col-lg-12">
          <AlertsPanel alerts={alerts} />
        </div>
      </section>

      {/* Upcoming Renewals */}
      {upcomingRenewals.length > 0 && (
        <section className="row gy-4 mt-24">
          <div className="col-12">
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h6 className="card-title mb-0">
                  <Icon icon="mdi:server-network" className="me-2" style={{ fontSize: '18px' }} />
                  Upcoming Renewals
                </h6>
                <Link href="/services" className="btn btn-outline-secondary btn-sm">
                  View All
                </Link>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-dark table-hover mb-0">
                    <thead>
                      <tr className="text-secondary-light text-xs">
                        <th>Service</th>
                        <th>Client</th>
                        <th>Renewal Date</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingRenewals.slice(0, 5).map((svc) => (
                        <tr key={svc.id}>
                          <td>
                            <span className="text-white text-sm fw-medium">{svc.serviceName}</span>
                            <span className="text-secondary-light text-xs d-block">{svc.provider}</span>
                          </td>
                          <td><span className="text-white text-sm">{svc.clientName}</span></td>
                          <td>
                            <span className="text-sm" style={{ color: '#ffc107' }}>
                              {svc.renewalDate ? new Date(svc.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </span>
                          </td>
                          <td><span className="text-white text-sm">${(Number(svc.monthlyCost) || 0).toFixed(2)}/mo</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Contracts for Review — admin only */}
      {teamUser.role === 'admin' && draftProposals.length > 0 && (
        <section className="row gy-4 mt-24">
          <div className="col-12">
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h6 className="card-title mb-0">
                  <Icon icon="mdi:file-document-edit-outline" className="me-2" style={{ fontSize: '18px' }} />
                  Contracts for Review
                </h6>
                <Link href="/proposals?status=draft" className="btn btn-outline-secondary btn-sm">
                  View All Drafts
                </Link>
              </div>
              <div className="card-body p-0">
                {draftProposals.map((row) => (
                  <div
                    key={row.created_by}
                    className="d-flex align-items-center justify-content-between px-4 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div>
                      <span className="text-white text-sm fw-medium">{row.creator_name}</span>
                      <span className="text-secondary-light text-sm ms-2">
                        has {row.draft_count} proposal{row.draft_count !== 1 ? 's' : ''} for review
                      </span>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                      {(row.proposals || []).slice(0, 3).map((p) => (
                        <Link
                          key={p.id}
                          href={`/proposals/${p.id}`}
                          className="badge text-decoration-none"
                          style={{ background: 'rgba(13,110,253,0.15)', color: '#4d94ff', fontSize: '11px' }}
                        >
                          {(p.title || 'Untitled').slice(0, 30)}
                        </Link>
                      ))}
                      {(row.proposals || []).length > 3 && (
                        <span className="text-secondary-light text-xs">+{row.proposals.length - 3} more</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Activity Feed */}
      <section className="row gy-4 mt-24">
        <div className="col-12">
          <ActivityFeed activity={activity} teamUserId={teamUser.id} />
        </div>
      </section>
    </>
  );
};

export default DashBoardLayer;
