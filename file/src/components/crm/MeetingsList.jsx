'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { updateMeetingStatus, cancelMeeting, completeMeeting } from '@/lib/actions/meetings';

const STATUS_BADGES = {
  scheduled: { label: 'Scheduled', color: '#0d6efd' },
  rescheduled: { label: 'Rescheduled', color: '#ffc107' },
  completed: { label: 'Completed', color: '#198754' },
  cancelled: { label: 'Cancelled', color: '#6c757d' },
  no_show: { label: 'No Show', color: '#dc3545' },
};

const SOURCE_LABELS = {
  calcom: 'Cal.com',
  manual: 'Manual',
  website: 'Website',
};

function formatTimeRange(start, end) {
  if (!start) return '—';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const dateStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const startTime = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTime = e ? e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  return `${dateStr}, ${startTime}${endTime ? ` – ${endTime}` : ''}`;
}

const MeetingsList = ({ meetings: initialMeetings }) => {
  const [meetings, setMeetings] = useState(initialMeetings || []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isPending, startTransition] = useTransition();

  const filtered = meetings.filter((m) => {
    if (statusFilter && m.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (m.title || '').toLowerCase().includes(q) ||
        (m.attendeeName || '').toLowerCase().includes(q) ||
        (m.attendeeEmail || '').toLowerCase().includes(q) ||
        (m.leadName || '').toLowerCase().includes(q) ||
        (m.clientName || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleStatusChange = async (meetingId, newStatus) => {
    startTransition(async () => {
      let result;
      if (newStatus === 'cancelled') {
        result = await cancelMeeting(meetingId);
      } else if (newStatus === 'completed') {
        result = await completeMeeting(meetingId);
      } else {
        result = await updateMeetingStatus(meetingId, newStatus);
      }
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Meeting status updated');
        setMeetings((prev) =>
          prev.map((m) => (m.id === meetingId ? { ...m, status: newStatus } : m))
        );
      }
    });
  };

  return (
    <div>
      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body py-3">
          <div className="row g-3 align-items-center">
            <div className="col-md-6">
              <div className="position-relative">
                <Icon
                  icon="mdi:magnify"
                  className="position-absolute text-secondary-light"
                  style={{ left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}
                />
                <input
                  type="text"
                  className="form-control ps-5"
                  placeholder="Search meetings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
            <div className="col-md-3 text-end">
              <span className="text-secondary-light text-sm">
                {filtered.length} meeting{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <Icon icon="mdi:calendar-blank-outline" className="text-secondary-light mb-3" style={{ fontSize: 48 }} />
            <h6 className="text-white mb-2">No meetings found</h6>
            <p className="text-secondary-light text-sm mb-0">
              {meetings.length === 0
                ? 'Meetings from Cal.com and manual entries will appear here.'
                : 'Try adjusting your filters.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {filtered.map((m) => {
            const badge = STATUS_BADGES[m.status] || STATUS_BADGES.scheduled;
            const isWebsite = m._isCalendarEvent || m.source === 'website';

            return (
              <div key={m.id} className="card">
                <div className="card-body p-3">
                  <div className="d-flex align-items-start justify-content-between gap-3">
                    <div className="d-flex align-items-start gap-3 flex-grow-1 min-w-0">
                      <div
                        className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                        style={{
                          width: 40,
                          height: 40,
                          background: `${badge.color}22`,
                          color: badge.color,
                        }}
                      >
                        <Icon
                          icon={m.status === 'cancelled' ? 'mdi:calendar-remove-outline' : 'mdi:calendar-check-outline'}
                          style={{ fontSize: 20 }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h6 className="text-white fw-semibold mb-1 text-truncate">{m.title}</h6>
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                          <span className="text-secondary-light text-xs">
                            <Icon icon="mdi:clock-outline" className="me-1" style={{ fontSize: 13 }} />
                            {formatTimeRange(m.startTime, m.endTime)}
                          </span>
                          {m.attendeeName && (
                            <span className="text-secondary-light text-xs">
                              <Icon icon="mdi:account-outline" className="me-1" style={{ fontSize: 13 }} />
                              {m.attendeeName}
                            </span>
                          )}
                          {m.attendeeEmail && (
                            <span className="text-secondary-light text-xs">{m.attendeeEmail}</span>
                          )}
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <span
                            className="badge text-xs"
                            style={{ background: `${badge.color}22`, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                          <span className="text-secondary-light text-xs">
                            {SOURCE_LABELS[m.source] || m.source}
                          </span>
                          {m.clientName && (
                            <Link href={`/clients/${m.clientId}`} className="text-xs text-primary text-decoration-none">
                              <Icon icon="mdi:account-tie" className="me-1" style={{ fontSize: 12 }} />
                              {m.clientName}
                            </Link>
                          )}
                          {m.leadName && !m.clientName && (
                            <Link href={`/leads/${m.leadId}`} className="text-xs text-primary text-decoration-none">
                              <Icon icon="mdi:account-outline" className="me-1" style={{ fontSize: 12 }} />
                              {m.leadName}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                      {m.meetingUrl && m.status !== 'cancelled' && m.status !== 'completed' && (
                        <a
                          href={m.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-primary"
                          title="Join meeting"
                        >
                          <Icon icon="mdi:video-outline" style={{ fontSize: 16 }} />
                        </a>
                      )}
                      {m.status === 'scheduled' && !isWebsite && (
                        <div className="dropdown">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            data-bs-toggle="dropdown"
                            disabled={isPending}
                          >
                            <Icon icon="mdi:dots-vertical" style={{ fontSize: 16 }} />
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end">
                            <li>
                              <button className="dropdown-item text-sm" onClick={() => handleStatusChange(m.id, 'completed')}>
                                <Icon icon="mdi:check" className="me-2" />Mark Completed
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item text-sm" onClick={() => handleStatusChange(m.id, 'no_show')}>
                                <Icon icon="mdi:account-off-outline" className="me-2" />No Show
                              </button>
                            </li>
                            <li><hr className="dropdown-divider" /></li>
                            <li>
                              <button className="dropdown-item text-sm text-danger" onClick={() => handleStatusChange(m.id, 'cancelled')}>
                                <Icon icon="mdi:close-circle-outline" className="me-2" />Cancel
                              </button>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MeetingsList;
