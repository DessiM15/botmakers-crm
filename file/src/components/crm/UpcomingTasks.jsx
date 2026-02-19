import Link from 'next/link';
import { Icon } from '@iconify/react';

const UpcomingTasks = ({ milestones }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="card h-100">
      <div className="card-header border-bottom">
        <h6 className="text-lg fw-semibold mb-0">Upcoming Tasks</h6>
      </div>
      <div className="card-body">
        {milestones.length === 0 ? (
          <div className="text-center py-4">
            <Icon
              icon="mdi:check-circle-outline"
              className="text-success mb-2"
              style={{ fontSize: '32px' }}
            />
            <p className="text-secondary-light text-sm mb-0">
              No upcoming milestones — you're all caught up!
            </p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {milestones.map((ms) => {
              const dueDate = ms.dueDate ? new Date(ms.dueDate) : null;
              const isOverdue = dueDate && dueDate < today;
              const statusColor = ms.status === 'overdue' || isOverdue ? '#dc3545' : ms.status === 'in_progress' ? '#0d6efd' : '#6c757d';

              return (
                <div
                  key={ms.id}
                  className="d-flex align-items-center gap-3 p-2 rounded"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <Icon
                    icon={isOverdue ? 'mdi:alert-circle' : 'mdi:circle-outline'}
                    style={{ fontSize: '16px', color: statusColor, flexShrink: 0 }}
                  />
                  <div className="flex-grow-1 min-w-0">
                    <div className="text-white text-sm fw-medium text-truncate">
                      {ms.title}
                    </div>
                    <Link
                      href={`/projects/${ms.projectId}`}
                      className="text-secondary-light text-xs text-decoration-none"
                    >
                      {ms.projectName}
                    </Link>
                  </div>
                  <div className="text-end flex-shrink-0">
                    {dueDate && (
                      <span
                        className="text-xs fw-medium"
                        style={{ color: isOverdue ? '#dc3545' : '#94a3b8' }}
                      >
                        {dueDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                    <div>
                      <span
                        className="badge text-xs"
                        style={{
                          background: `${statusColor}22`,
                          color: statusColor,
                          fontSize: '10px',
                        }}
                      >
                        {isOverdue ? 'Overdue' : ms.status === 'in_progress' ? 'In Progress' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingTasks;
