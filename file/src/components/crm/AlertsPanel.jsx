import { Icon } from '@iconify/react';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils/formatters';

const STAGE_LABELS = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  discovery_scheduled: 'Discovery Scheduled',
  discovery_completed: 'Discovery Completed',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  contract_signed: 'Contract Signed',
};

const AlertsPanel = ({ alerts }) => {
  const { staleLeads = [], overdueMilestones = [], pendingQuestions = [] } = alerts || {};
  const hasAlerts =
    staleLeads.length > 0 ||
    overdueMilestones.length > 0 ||
    pendingQuestions.length > 0;

  if (!hasAlerts) {
    return (
      <div className="card h-100">
        <div className="card-header border-bottom">
          <h6 className="text-lg fw-semibold mb-0">Alerts</h6>
        </div>
        <div className="card-body d-flex flex-column justify-content-center align-items-center py-40">
          <Icon
            icon="solar:check-circle-bold"
            className="text-success-main mb-12"
            style={{ fontSize: '2.5rem' }}
          />
          <p className="text-primary-light mb-0">
            All clear — no alerts right now
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-100">
      <div className="card-header border-bottom">
        <h6 className="text-lg fw-semibold mb-0">Alerts</h6>
      </div>
      <div className="card-body p-0">
        {staleLeads.length > 0 && (
          <div className="border-bottom">
            <div
              className="px-24 py-12 d-flex align-items-center gap-2"
              style={{ backgroundColor: 'rgba(255, 152, 0, 0.08)' }}
            >
              <Icon icon="solar:alarm-bold" className="text-warning-main" />
              <span className="fw-medium text-warning-main text-sm">
                Stale Leads ({staleLeads.length})
              </span>
            </div>
            {staleLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="d-flex align-items-center justify-content-between px-24 py-10 text-decoration-none border-bottom"
              >
                <div>
                  <span className="text-primary-light fw-medium text-sm">
                    {lead.fullName}
                  </span>
                  <span className="text-secondary-light text-xs ms-8">
                    {STAGE_LABELS[lead.pipelineStage] || lead.pipelineStage}
                  </span>
                </div>
                <span className="text-secondary-light text-xs">
                  {lead.lastContactedAt
                    ? formatRelativeTime(lead.lastContactedAt)
                    : 'Never contacted'}
                </span>
              </Link>
            ))}
          </div>
        )}

        {overdueMilestones.length > 0 && (
          <div className="border-bottom">
            <div
              className="px-24 py-12 d-flex align-items-center gap-2"
              style={{ backgroundColor: 'rgba(244, 67, 54, 0.08)' }}
            >
              <Icon
                icon="solar:danger-circle-bold"
                className="text-danger-main"
              />
              <span className="fw-medium text-danger-main text-sm">
                Overdue Milestones ({overdueMilestones.length})
              </span>
            </div>
            {overdueMilestones.map((ms) => (
              <Link
                key={ms.id}
                href={`/projects/${ms.projectId}`}
                className="d-flex align-items-center justify-content-between px-24 py-10 text-decoration-none border-bottom"
              >
                <div>
                  <span className="text-primary-light fw-medium text-sm">
                    {ms.title}
                  </span>
                  <span className="text-secondary-light text-xs ms-8">
                    {ms.projectName}
                  </span>
                </div>
                <span className="text-danger-main text-xs">Due {ms.dueDate}</span>
              </Link>
            ))}
          </div>
        )}

        {pendingQuestions.length > 0 && (
          <div>
            <div
              className="px-24 py-12 d-flex align-items-center gap-2"
              style={{ backgroundColor: 'rgba(255, 193, 7, 0.08)' }}
            >
              <Icon
                icon="solar:chat-round-unread-bold"
                className="text-warning-600"
              />
              <span className="fw-medium text-warning-600 text-sm">
                Pending Questions ({pendingQuestions.length})
              </span>
            </div>
            {pendingQuestions.map((q) => (
              <Link
                key={q.id}
                href={`/projects/${q.projectId}`}
                className="d-flex align-items-center justify-content-between px-24 py-10 text-decoration-none border-bottom"
              >
                <div className="text-truncate" style={{ maxWidth: '70%' }}>
                  <span className="text-primary-light fw-medium text-sm text-truncate d-block">
                    {q.questionText}
                  </span>
                  <span className="text-secondary-light text-xs">
                    {q.projectName}
                  </span>
                </div>
                <span className="text-secondary-light text-xs">
                  {formatRelativeTime(q.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPanel;
