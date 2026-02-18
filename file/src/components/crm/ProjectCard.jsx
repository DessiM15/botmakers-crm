'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { formatDate, formatCurrency, formatRelativeTime } from '@/lib/utils/formatters';
import { PROJECT_STATUSES } from '@/lib/utils/constants';

const ProjectCard = ({ project }) => {
  const totalMs = Number(project.totalMilestones) || 0;
  const completedMs = Number(project.completedMilestones) || 0;
  const progress = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;

  const statusObj = PROJECT_STATUSES.find((s) => s.value === project.status) || PROJECT_STATUSES[0];

  return (
    <Link
      href={`/projects/${project.id}`}
      className="text-decoration-none"
    >
      <div className="card h-100" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}>
        <div className="card-body p-3">
          {/* Header: name + status */}
          <div className="d-flex align-items-start justify-content-between mb-2">
            <h6 className="text-white fw-semibold mb-0 text-truncate" style={{ maxWidth: '70%' }}>
              {project.name}
            </h6>
            <span
              className="badge fw-medium text-xs"
              style={{
                background: `${statusObj.color}20`,
                color: statusObj.color,
              }}
            >
              {statusObj.label}
            </span>
          </div>

          {/* Client */}
          <p className="text-secondary-light text-sm mb-3">
            <Icon icon="mdi:account-outline" style={{ fontSize: '14px' }} className="me-1" />
            {project.clientName}
            {project.clientCompany ? ` — ${project.clientCompany}` : ''}
          </p>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="d-flex justify-content-between text-xs mb-1">
              <span className="text-secondary-light">Progress</span>
              <span className="text-white fw-medium">{progress}%</span>
            </div>
            <div
              className="progress"
              style={{ height: '6px', background: 'rgba(255,255,255,0.1)' }}
            >
              <div
                className="progress-bar"
                role="progressbar"
                style={{
                  width: `${progress}%`,
                  background: progress === 100 ? '#198754' : '#03FF00',
                }}
              />
            </div>
            <p className="text-secondary-light text-xs mt-1 mb-0">
              {completedMs}/{totalMs} milestones
            </p>
          </div>

          {/* Footer: phase + last activity */}
          <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-secondary-subtle">
            <div className="text-xs">
              {project.currentPhase ? (
                <span className="text-secondary-light">
                  <Icon icon="mdi:flag-outline" className="me-1" style={{ fontSize: '12px' }} />
                  {project.currentPhase}
                </span>
              ) : (
                <span className="text-secondary-light">—</span>
              )}
            </div>
            <div className="text-xs text-secondary-light">
              {project.lastActivity
                ? formatRelativeTime(project.lastActivity)
                : formatDate(project.createdAt)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProjectCard;
