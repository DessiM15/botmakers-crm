import Link from 'next/link';
import { Icon } from '@iconify/react';

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const TodaySchedule = ({ meetings = [], upcomingMilestones = [] }) => {
  return (
    <div className="card h-100">
      <div className="card-header border-bottom d-flex align-items-center justify-content-between">
        <h6 className="fw-semibold mb-0 text-sm">
          <Icon icon="mdi:calendar-today" className="me-1" style={{ fontSize: '16px' }} />
          Today's Schedule
        </h6>
        <Link href="/calendar" className="text-primary-600 text-xs text-decoration-none">
          Full Calendar
        </Link>
      </div>
      <div className="card-body p-0" style={{ maxHeight: '380px', overflowY: 'auto' }}>
        {/* Meetings */}
        {meetings.length === 0 && upcomingMilestones.length === 0 && (
          <div className="text-center py-4">
            <Icon icon="mdi:calendar-blank-outline" className="text-secondary-light mb-2" style={{ fontSize: '28px' }} />
            <p className="text-secondary-light text-xs mb-0">No meetings today</p>
          </div>
        )}

        {meetings.length > 0 && (
          <div className="px-3 pt-2 pb-1">
            <span className="text-secondary-light fw-medium" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Meetings
            </span>
          </div>
        )}
        {meetings.map((m) => (
          <div
            key={m.id}
            className="d-flex align-items-center gap-2 px-3 py-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div
              className="flex-shrink-0 rounded"
              style={{ width: '3px', height: '32px', background: m.source === 'website' ? '#e85d04' : '#0d6efd' }}
            />
            <div className="flex-grow-1 min-w-0">
              <div className="text-white text-xs fw-medium text-truncate">{m.title}</div>
              <div className="text-secondary-light" style={{ fontSize: '10px' }}>
                {formatTime(m.startTime)}
                {m.attendeeName ? ` · ${m.attendeeName}` : ''}
              </div>
            </div>
            {m.meetingUrl && (
              <a
                href={m.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm d-flex align-items-center gap-1 flex-shrink-0"
                style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  background: '#0d6efd22',
                  color: '#0d6efd',
                  borderRadius: '4px',
                  textDecoration: 'none',
                }}
              >
                <Icon icon="mdi:video-outline" style={{ fontSize: '12px' }} />
                Join
              </a>
            )}
          </div>
        ))}

        {/* Upcoming Milestones */}
        {upcomingMilestones.length > 0 && (
          <>
            <div className="px-3 pt-2 pb-1">
              <span className="text-secondary-light fw-medium" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Upcoming Milestones
              </span>
            </div>
            {upcomingMilestones.slice(0, 3).map((ms) => {
              const dueDate = ms.dueDate ? new Date(ms.dueDate) : null;
              const isOverdue = dueDate && dueDate < new Date(new Date().setHours(0, 0, 0, 0));
              return (
                <div
                  key={ms.id}
                  className="d-flex align-items-center gap-2 px-3 py-2"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div
                    className="flex-shrink-0 rounded"
                    style={{ width: '3px', height: '32px', background: isOverdue ? '#dc3545' : '#03FF00' }}
                  />
                  <div className="flex-grow-1 min-w-0">
                    <div className="text-white text-xs fw-medium text-truncate">{ms.title}</div>
                    <Link
                      href={`/projects/${ms.projectId}`}
                      className="text-secondary-light text-decoration-none"
                      style={{ fontSize: '10px' }}
                    >
                      {ms.projectName}
                    </Link>
                  </div>
                  {dueDate && (
                    <span
                      className="text-xs flex-shrink-0 fw-medium"
                      style={{ fontSize: '10px', color: isOverdue ? '#dc3545' : '#94a3b8' }}
                    >
                      {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default TodaySchedule;
