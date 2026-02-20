'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { updateLeadAssignment } from '@/lib/actions/leads';

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const SCORE_COLORS = {
  high: 'bg-success-600',
  medium: 'bg-warning-600',
  low: 'bg-neutral-500',
};

export default function NewLeadsAssign({ leads = [], teamMembers = [] }) {
  const [assigning, setAssigning] = useState(null);

  const handleAssign = async (leadId, teamUserId) => {
    setAssigning(leadId);
    try {
      const result = await updateLeadAssignment(leadId, teamUserId);
      if (result.error) {
        toast.error(result.error);
      } else {
        const member = teamMembers.find((m) => m.id === teamUserId);
        toast.success(`Lead assigned to ${member?.fullName || 'team member'}`);
      }
    } catch {
      toast.error('Failed to assign lead');
    } finally {
      setAssigning(null);
    }
  };

  if (leads.length === 0) {
    return (
      <div className="card h-100">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h6 className="text-white fw-semibold mb-0">
            <Icon icon="solar:user-plus-bold" className="me-2 text-warning-600" />
            Unassigned Leads
          </h6>
          <Link href="/leads" className="btn btn-sm btn-outline-primary-600">
            View All
          </Link>
        </div>
        <div className="card-body d-flex align-items-center justify-content-center py-32">
          <div className="text-center">
            <Icon icon="solar:check-circle-bold" className="text-success-600 mb-8" style={{ fontSize: 36 }} />
            <p className="text-secondary-light mb-0">All leads are assigned!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-100">
      <div className="card-header d-flex align-items-center justify-content-between">
        <h6 className="text-white fw-semibold mb-0">
          <Icon icon="solar:user-plus-bold" className="me-2 text-warning-600" />
          Unassigned Leads
          <span className="badge bg-warning-600 ms-2 text-sm">{leads.length}</span>
        </h6>
        <Link href="/leads" className="btn btn-sm btn-outline-primary-600">
          View All
        </Link>
      </div>
      <div className="card-body p-0" style={{ maxHeight: 420, overflowY: 'auto' }}>
        {leads.map((lead) => (
          <div
            key={lead.id}
            className="px-16 py-12 border-bottom border-neutral-600"
          >
            <div className="d-flex align-items-start justify-content-between mb-4">
              <div className="flex-grow-1 me-12">
                <div className="d-flex align-items-center gap-2 mb-4">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="text-white fw-medium text-decoration-none"
                    style={{ fontSize: '14px' }}
                  >
                    {lead.fullName}
                  </Link>
                  {lead.score && (
                    <span className={`badge ${SCORE_COLORS[lead.score] || 'bg-neutral-500'} text-xs`}>
                      {lead.score}
                    </span>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2 text-xs text-secondary-light">
                  {lead.companyName && (
                    <span>{lead.companyName}</span>
                  )}
                  {lead.source && (
                    <span className="badge bg-neutral-600 text-xs">{lead.source}</span>
                  )}
                  <span>{timeAgo(lead.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Quick-assign buttons */}
            <div className="d-flex flex-wrap gap-1 mt-8">
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  className="btn btn-sm btn-outline-primary-600 py-2 px-8"
                  style={{ fontSize: '11px' }}
                  onClick={() => handleAssign(lead.id, member.id)}
                  disabled={assigning === lead.id}
                  title={`Assign to ${member.fullName}`}
                >
                  {assigning === lead.id ? (
                    <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }} />
                  ) : (
                    member.fullName.split(' ')[0]
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
