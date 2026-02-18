import { Icon } from '@iconify/react';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils/formatters';

const ENTITY_ICONS = {
  lead: 'solar:user-bold',
  client: 'solar:users-group-two-rounded-bold',
  project: 'solar:code-bold',
  proposal: 'solar:document-bold',
  invoice: 'solar:wallet-bold',
  payment: 'solar:card-bold',
  milestone: 'solar:flag-bold',
};

const ENTITY_ROUTES = {
  lead: '/leads',
  client: '/clients',
  project: '/projects',
  proposal: '/proposals',
  invoice: '/invoices',
};

function formatAction(action) {
  const parts = action.split('.');
  if (parts.length < 2) return action;

  const entity = parts[0];
  const verb = parts[1];

  const verbLabels = {
    created: 'created',
    updated: 'updated',
    deleted: 'deleted',
    converted: 'converted',
    sent: 'sent',
    accepted: 'accepted',
    declined: 'declined',
    paid: 'marked as paid',
    stage_changed: 'moved',
    assigned: 'assigned',
    replied: 'replied to',
  };

  const entityLabels = {
    lead: 'a lead',
    client: 'a client',
    project: 'a project',
    proposal: 'a proposal',
    invoice: 'an invoice',
    payment: 'a payment',
    milestone: 'a milestone',
    question: 'a question',
  };

  const verbText = verbLabels[verb] || verb;
  const entityText = entityLabels[entity] || `a ${entity}`;

  return `${verbText} ${entityText}`;
}

const ActivityFeed = ({ activity }) => {
  if (!activity || activity.length === 0) {
    return (
      <div className="card h-100">
        <div className="card-header border-bottom">
          <h6 className="text-lg fw-semibold mb-0">Recent Activity</h6>
        </div>
        <div className="card-body d-flex flex-column justify-content-center align-items-center py-40">
          <Icon
            icon="solar:history-bold"
            className="text-secondary-light mb-12"
            style={{ fontSize: '2.5rem' }}
          />
          <p className="text-secondary-light mb-0">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-100">
      <div className="card-header border-bottom d-flex align-items-center justify-content-between">
        <h6 className="text-lg fw-semibold mb-0">Recent Activity</h6>
        <Link
          href="/activity"
          className="text-primary-600 text-sm fw-medium text-decoration-none"
        >
          View All
        </Link>
      </div>
      <div className="card-body p-0">
        {activity.map((entry) => {
          const icon =
            ENTITY_ICONS[entry.entityType] || 'solar:info-circle-bold';
          const route = ENTITY_ROUTES[entry.entityType];
          const href = route ? `${route}/${entry.entityId}` : null;

          return (
            <div
              key={entry.id}
              className="d-flex align-items-start gap-12 px-24 py-12 border-bottom"
            >
              <div className="w-40-px h-40-px bg-primary-50 rounded-circle d-flex justify-content-center align-items-center flex-shrink-0">
                <Icon icon={icon} className="text-primary-600 text-lg" />
              </div>
              <div className="flex-grow-1 min-w-0">
                <p className="text-primary-light text-sm mb-4">
                  <span className="fw-semibold">{entry.actorName}</span>{' '}
                  {formatAction(entry.action)}
                </p>
                {href && (
                  <Link
                    href={href}
                    className="text-primary-600 text-xs text-decoration-none"
                  >
                    View {entry.entityType}
                  </Link>
                )}
              </div>
              <span className="text-secondary-light text-xs flex-shrink-0">
                {formatRelativeTime(entry.createdAt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityFeed;
