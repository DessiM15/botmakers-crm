'use client';

import { useState, useMemo } from 'react';
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

const PER_PAGE = 15;

const ActivityFeed = ({ activity, teamUserId }) => {
  const [mode, setMode] = useState('my'); // 'my' or 'all'
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (mode === 'all') return activity || [];
    return (activity || []).filter(
      (entry) => entry.actorId === teamUserId
    );
  }, [activity, mode, teamUserId]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setPage(1);
  };

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
      <div className="card-header border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h6 className="text-lg fw-semibold mb-0">Recent Activity</h6>
        <div className="d-flex align-items-center gap-3">
          {/* Toggle: My Activity / All Activity */}
          <div className="btn-group btn-group-sm" role="group">
            <button
              type="button"
              className={`btn ${mode === 'my' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => handleModeChange('my')}
              style={{ fontSize: '12px', padding: '4px 12px' }}
            >
              My Activity
            </button>
            <button
              type="button"
              className={`btn ${mode === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => handleModeChange('all')}
              style={{ fontSize: '12px', padding: '4px 12px' }}
            >
              All Activity
            </button>
          </div>
          <Link
            href="/activity"
            className="text-sm fw-medium text-decoration-none"
            style={{ color: '#03FF00' }}
          >
            View All
          </Link>
        </div>
      </div>
      <div className="card-body p-0">
        {paginated.length === 0 ? (
          <div className="text-center py-4">
            <Icon icon="solar:history-bold" className="text-secondary-light mb-2" style={{ fontSize: '2rem' }} />
            <p className="text-secondary-light text-sm mb-0">No activity to show</p>
          </div>
        ) : (
          paginated.map((entry) => {
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
                  <Icon icon={icon} className="text-lg" style={{ color: '#94a3b8' }} />
                </div>
                <div className="flex-grow-1 min-w-0">
                  <p className="text-primary-light text-sm mb-4">
                    <span className="fw-semibold">{entry.actorName}</span>{' '}
                    {formatAction(entry.action)}
                  </p>
                  {href && (
                    <Link
                      href={href}
                      className="text-xs text-decoration-none"
                      style={{ color: '#03FF00' }}
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
          })
        )}
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="card-footer d-flex align-items-center justify-content-between">
          <span className="text-secondary-light text-xs">
            Page {page} of {totalPages}
          </span>
          <div className="d-flex gap-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
