'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import Link from 'next/link';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const ACTION_ICONS = {
  'lead.created': 'mdi:account-plus-outline',
  'lead.stage_changed': 'mdi:swap-horizontal',
  'lead.notes_updated': 'mdi:note-edit-outline',
  'lead.assigned': 'mdi:account-arrow-right-outline',
  'lead.stale_detected': 'mdi:clock-alert-outline',
  'contact.created': 'mdi:phone-outline',
  'client.created': 'mdi:account-check-outline',
  'project.created': 'mdi:folder-plus-outline',
  'milestone.completed': 'mdi:flag-checkered',
  'milestone.overdue_detected': 'mdi:alert-circle-outline',
  'proposal.created': 'mdi:file-document-plus-outline',
  'proposal.sent': 'mdi:send',
  'proposal.accepted': 'mdi:check-circle-outline',
  'invoice.created': 'mdi:receipt-text-plus-outline',
  'payment.received': 'mdi:cash-check',
  'question.created': 'mdi:help-circle-outline',
  'question.replied': 'mdi:reply',
  'repo.linked': 'mdi:github',
  'demo.created': 'mdi:monitor-screenshot',
};

const ENTITY_ROUTES = {
  lead: '/leads',
  client: '/clients',
  project: '/projects',
  proposal: '/proposals',
  invoice: '/invoices',
};

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ActivityLogView = ({ entries, total, page, totalPages, filters }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setFilter = (key, value) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' || value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete('page');
    router.push(`/activity?${params.toString()}`);
  };

  const setDate = (key, date) => {
    const params = new URLSearchParams(searchParams.toString());
    if (date) {
      params.set(key, date.toISOString().split('T')[0]);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/activity?${params.toString()}`);
  };

  const setPage = (p) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/activity?${params.toString()}`);
  };

  const fromDate = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : null;
  const toDate = filters.dateTo ? new Date(filters.dateTo + 'T00:00:00') : null;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="text-white fw-semibold mb-0">Activity Log</h4>
        <span className="text-secondary-light text-sm">{total} entries</span>
      </div>

      {/* Filters */}
      <div className="d-flex gap-3 mb-4 flex-wrap">
        <select
          className="form-select form-select-sm bg-base text-white"
          style={{ width: 'auto' }}
          value={filters.actorType}
          onChange={(e) => setFilter('actor', e.target.value)}
        >
          <option value="all">All Actors</option>
          <option value="team">Team</option>
          <option value="client">Client</option>
          <option value="system">System</option>
        </select>
        <select
          className="form-select form-select-sm bg-base text-white"
          style={{ width: 'auto' }}
          value={filters.entityType}
          onChange={(e) => setFilter('entity', e.target.value)}
        >
          <option value="all">All Entities</option>
          <option value="lead">Leads</option>
          <option value="client">Clients</option>
          <option value="project">Projects</option>
          <option value="proposal">Proposals</option>
          <option value="invoice">Invoices</option>
        </select>
        <div className="d-flex align-items-center gap-2">
          <span className="text-secondary-light text-xs">From</span>
          <DatePicker
            selected={fromDate}
            onChange={(date) => setDate('from', date)}
            className="form-control form-control-sm bg-base text-white"
            placeholderText="Start date"
            dateFormat="MMM d, yyyy"
            maxDate={toDate || new Date()}
            isClearable
          />
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="text-secondary-light text-xs">To</span>
          <DatePicker
            selected={toDate}
            onChange={(date) => setDate('to', date)}
            className="form-control form-control-sm bg-base text-white"
            placeholderText="End date"
            dateFormat="MMM d, yyyy"
            minDate={fromDate}
            maxDate={new Date()}
            isClearable
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="card">
          <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
            <Icon icon="mdi:history" className="text-secondary-light mb-2" style={{ fontSize: '36px' }} />
            <p className="text-secondary-light text-sm mb-0">
              No activity entries found.
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            <div className="d-flex flex-column">
              {entries.map((entry) => {
                const icon = ACTION_ICONS[entry.action] || 'mdi:circle-outline';
                const entityRoute = ENTITY_ROUTES[entry.entity_type];
                const actionLabel = entry.action.replace(/\./g, ' ').replace(/_/g, ' ');

                return (
                  <div
                    key={entry.id}
                    className="d-flex align-items-start gap-3 px-4 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div
                      className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        background: entry.actor_type === 'system'
                          ? 'rgba(13,202,240,0.1)'
                          : entry.actor_type === 'client'
                            ? 'rgba(3,255,0,0.1)'
                            : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      <Icon
                        icon={icon}
                        style={{
                          fontSize: '18px',
                          color: entry.actor_type === 'system'
                            ? '#0dcaf0'
                            : entry.actor_type === 'client'
                              ? '#03FF00'
                              : '#94a3b8',
                        }}
                      />
                    </div>

                    <div className="flex-grow-1 min-w-0">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="text-white text-sm fw-medium">
                          {entry.actor_name}
                        </span>
                        <span className="text-secondary-light text-xs">
                          {actionLabel}
                        </span>
                      </div>
                      {entry.metadata && typeof entry.metadata === 'object' && (
                        <p className="text-secondary-light text-xs mb-0">
                          {entry.metadata.title && `"${entry.metadata.title}"`}
                          {entry.metadata.from && entry.metadata.to &&
                            ` ${entry.metadata.from.replace(/_/g, ' ')} → ${entry.metadata.to.replace(/_/g, ' ')}`
                          }
                          {entry.metadata.count && ` (${entry.metadata.count} items)`}
                        </p>
                      )}
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                      {entityRoute && entry.entity_id && (
                        <Link
                          href={`${entityRoute}/${entry.entity_id}`}
                          className="btn btn-sm btn-outline-secondary"
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                        >
                          View
                        </Link>
                      )}
                      <span className="text-secondary-light" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {timeAgo(entry.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
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
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ActivityLogView;
