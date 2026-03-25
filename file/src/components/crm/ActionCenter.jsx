'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { updateLeadAssignment } from '@/lib/actions/leads';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const URGENCY = {
  overdue_milestone: 1,
  pending_question: 2,
  stale_lead: 3,
  unassigned_lead: 4,
  follow_up: 5,
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'follow_ups', label: 'Follow-ups' },
];

function buildActionItems(alerts, unassignedLeads, followUps) {
  const items = [];

  // Overdue milestones
  if (alerts?.overdueMilestones) {
    for (const ms of alerts.overdueMilestones) {
      items.push({
        type: 'overdue_milestone',
        category: 'alerts',
        icon: 'mdi:alert-circle',
        color: '#dc3545',
        title: ms.title,
        subtitle: ms.projectName,
        time: ms.dueDate,
        link: `/projects/${ms.projectId}`,
        id: `ms-${ms.id}`,
      });
    }
  }

  // Pending questions
  if (alerts?.pendingQuestions) {
    for (const q of alerts.pendingQuestions) {
      items.push({
        type: 'pending_question',
        category: 'alerts',
        icon: 'mdi:chat-question-outline',
        color: '#ffc107',
        title: q.questionText?.slice(0, 60) + (q.questionText?.length > 60 ? '...' : ''),
        subtitle: q.projectName,
        time: q.createdAt,
        link: `/projects/${q.projectId}`,
        id: `q-${q.id}`,
      });
    }
  }

  // Stale leads
  if (alerts?.staleLeads) {
    for (const l of alerts.staleLeads) {
      items.push({
        type: 'stale_lead',
        category: 'alerts',
        icon: 'mdi:clock-alert-outline',
        color: '#fd7e14',
        title: l.fullName,
        subtitle: `Stage: ${l.pipelineStage?.replace(/_/g, ' ')}`,
        time: l.lastContactedAt || l.createdAt,
        link: `/leads/${l.id}`,
        id: `sl-${l.id}`,
      });
    }
  }

  // Unassigned leads
  if (unassignedLeads) {
    for (const l of unassignedLeads) {
      items.push({
        type: 'unassigned_lead',
        category: 'unassigned',
        icon: 'mdi:account-alert-outline',
        color: '#6f42c1',
        title: l.fullName,
        subtitle: l.companyName || l.email,
        time: l.createdAt,
        link: `/leads/${l.id}`,
        id: `ul-${l.id}`,
        leadId: l.id,
      });
    }
  }

  // Follow-ups
  if (followUps) {
    for (const f of followUps) {
      items.push({
        type: 'follow_up',
        category: 'follow_ups',
        icon: 'mdi:bell-ring-outline',
        color: '#0dcaf0',
        title: f.leadName || 'Follow-up',
        subtitle: f.triggerReason || 'Scheduled follow-up',
        time: f.remindAt,
        link: f.leadId ? `/leads/${f.leadId}` : null,
        id: `fu-${f.id}`,
      });
    }
  }

  // Sort by urgency
  items.sort((a, b) => (URGENCY[a.type] || 99) - (URGENCY[b.type] || 99));

  return items;
}

const ActionCenter = ({ alerts, unassignedLeads, followUps, teamMembers = [] }) => {
  const [filter, setFilter] = useState('all');
  const [assigningId, setAssigningId] = useState(null);
  const [isPending, startTransition] = useTransition();

  const items = buildActionItems(alerts, unassignedLeads, followUps);

  const filtered = filter === 'all'
    ? items
    : items.filter((i) => i.category === filter);

  const counts = {
    all: items.length,
    alerts: items.filter((i) => i.category === 'alerts').length,
    unassigned: items.filter((i) => i.category === 'unassigned').length,
    follow_ups: items.filter((i) => i.category === 'follow_ups').length,
  };

  const handleAssign = (leadId, teamMemberId) => {
    setAssigningId(leadId);
    startTransition(async () => {
      const result = await updateLeadAssignment(leadId, teamMemberId);
      setAssigningId(null);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('Lead assigned');
      }
    });
  };

  return (
    <div className="card h-100">
      <div className="card-header border-bottom d-flex align-items-center justify-content-between">
        <h6 className="fw-semibold mb-0 text-sm">
          <Icon icon="mdi:lightning-bolt" className="me-1" style={{ fontSize: '16px', color: '#ffc107' }} />
          Action Center
        </h6>
        <div className="d-flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className="btn btn-sm"
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                background: filter === f.key ? 'rgba(3,255,0,0.12)' : 'transparent',
                color: filter === f.key ? '#03FF00' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
              }}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span
                  className="ms-1 badge rounded-pill"
                  style={{
                    fontSize: '9px',
                    background: filter === f.key ? '#03FF0033' : 'rgba(255,255,255,0.08)',
                    color: filter === f.key ? '#03FF00' : '#94a3b8',
                    padding: '1px 5px',
                  }}
                >
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body p-0" style={{ maxHeight: '380px', overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div className="text-center py-4">
            <Icon icon="mdi:check-circle-outline" className="text-success mb-2" style={{ fontSize: '28px' }} />
            <p className="text-secondary-light text-xs mb-0">All clear — nothing needs attention</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="d-flex align-items-center gap-2 px-3 py-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              {/* Urgency dot */}
              <div
                className="flex-shrink-0 rounded-circle"
                style={{ width: '6px', height: '6px', background: item.color }}
              />
              {/* Icon */}
              <div
                className="d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '28px', height: '28px', borderRadius: '6px', background: `${item.color}15`, color: item.color }}
              >
                <Icon icon={item.icon} style={{ fontSize: '14px' }} />
              </div>
              {/* Content */}
              <div className="flex-grow-1 min-w-0">
                <div className="text-white text-xs fw-medium text-truncate">{item.title}</div>
                <div className="text-secondary-light" style={{ fontSize: '10px' }}>
                  {item.subtitle}
                </div>
              </div>
              {/* Time */}
              <span className="text-secondary-light flex-shrink-0" style={{ fontSize: '10px' }}>
                {timeAgo(item.time)}
              </span>
              {/* Actions */}
              {item.type === 'unassigned_lead' && teamMembers.length > 0 ? (
                <select
                  className="form-select form-select-sm bg-base text-white flex-shrink-0"
                  style={{ width: '110px', fontSize: '10px', padding: '2px 6px' }}
                  defaultValue=""
                  disabled={assigningId === item.leadId}
                  onChange={(e) => {
                    if (e.target.value) handleAssign(item.leadId, e.target.value);
                  }}
                >
                  <option value="">Assign...</option>
                  {teamMembers.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.fullName.split(' ')[0]}
                    </option>
                  ))}
                </select>
              ) : item.link ? (
                <Link
                  href={item.link}
                  className="flex-shrink-0"
                  style={{
                    fontSize: '10px',
                    color: '#0d6efd',
                    textDecoration: 'none',
                  }}
                >
                  View
                </Link>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActionCenter;
