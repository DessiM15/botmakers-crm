'use client';

import { useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { formatDate, formatRelativeTime } from '@/lib/utils/formatters';
import { PIPELINE_STAGES, LEAD_SCORES } from '@/lib/utils/constants';

const ReferralTable = ({ referrers, referrerLeads }) => {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getStageBadge = (stage) => {
    const cfg = PIPELINE_STAGES.find((s) => s.value === stage);
    if (!cfg) return null;
    return (
      <span
        className="badge text-xs fw-medium"
        style={{ background: `${cfg.color}22`, color: cfg.color }}
      >
        {cfg.label}
      </span>
    );
  };

  const getScoreBadge = (score) => {
    const cfg = LEAD_SCORES.find((s) => s.value === score);
    if (!cfg) return <span className="text-secondary-light text-xs">—</span>;
    return (
      <span
        className="badge text-xs fw-medium"
        style={{ background: `${cfg.color}22`, color: cfg.color }}
      >
        {cfg.label}
      </span>
    );
  };

  if (referrers.length === 0) {
    return (
      <div className="card">
        <div className="card-body d-flex flex-column justify-content-center align-items-center py-80">
          <Icon
            icon="mdi:account-multiple-outline"
            className="text-secondary-light mb-3"
            style={{ fontSize: '48px' }}
          />
          <h6 className="text-white fw-semibold mb-2">No referrals yet</h6>
          <p className="text-secondary-light text-sm mb-0">
            Referrals from the website will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-0">
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th className="text-secondary-light text-xs fw-semibold px-3 py-2" style={{ width: '30px' }} />
                <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                  Referrer
                </th>
                <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                  Email
                </th>
                <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                  Company
                </th>
                <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                  Total Referrals
                </th>
                <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                  Feedback
                </th>
                <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {referrers.map((ref) => {
                const isExpanded = expandedId === ref.id;
                const leads = referrerLeads[ref.id] || [];

                return (
                  <Fragment key={ref.id}>
                    <tr
                      className="cursor-pointer"
                      onClick={() => toggleExpand(ref.id)}
                    >
                      <td className="px-3 py-3">
                        <Icon
                          icon={
                            isExpanded
                              ? 'mdi:chevron-down'
                              : 'mdi:chevron-right'
                          }
                          className="text-secondary-light"
                          style={{ fontSize: '16px' }}
                        />
                      </td>
                      <td className="px-3 py-3 text-white text-sm fw-medium">
                        {ref.fullName}
                      </td>
                      <td className="px-3 py-3 text-secondary-light text-sm">
                        {ref.email}
                      </td>
                      <td className="px-3 py-3 text-secondary-light text-sm">
                        {ref.company || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className="badge bg-primary text-xs">
                          {ref.totalReferrals}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-secondary-light text-sm">
                        {ref.feedback
                          ? ref.feedback.length > 60
                            ? ref.feedback.slice(0, 60) + '...'
                            : ref.feedback
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-secondary-light text-sm">
                        {formatDate(ref.createdAt)}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div
                            className="px-4 py-3"
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            <h6 className="text-white text-sm fw-semibold mb-3">
                              Referred Leads ({leads.length})
                            </h6>
                            {leads.length === 0 ? (
                              <p className="text-secondary-light text-sm mb-0">
                                No leads from this referrer yet.
                              </p>
                            ) : (
                              <div className="table-responsive">
                                <table className="table table-sm mb-0">
                                  <thead>
                                    <tr>
                                      <th className="text-secondary-light text-xs fw-semibold px-2 py-1">
                                        Name
                                      </th>
                                      <th className="text-secondary-light text-xs fw-semibold px-2 py-1">
                                        Email
                                      </th>
                                      <th className="text-secondary-light text-xs fw-semibold px-2 py-1">
                                        Score
                                      </th>
                                      <th className="text-secondary-light text-xs fw-semibold px-2 py-1">
                                        Stage
                                      </th>
                                      <th className="text-secondary-light text-xs fw-semibold px-2 py-1">
                                        Created
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {leads.map((lead) => (
                                      <tr key={lead.id}>
                                        <td className="px-2 py-2">
                                          <a
                                            href={`/leads/${lead.id}`}
                                            className="text-white text-sm text-decoration-none fw-medium"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              router.push(
                                                `/leads/${lead.id}`
                                              );
                                            }}
                                          >
                                            {lead.fullName}
                                            {lead.companyName && (
                                              <span className="text-secondary-light text-xs d-block">
                                                {lead.companyName}
                                              </span>
                                            )}
                                          </a>
                                        </td>
                                        <td className="px-2 py-2 text-secondary-light text-sm">
                                          {lead.email}
                                        </td>
                                        <td className="px-2 py-2">
                                          {getScoreBadge(lead.score)}
                                        </td>
                                        <td className="px-2 py-2">
                                          {getStageBadge(lead.pipelineStage)}
                                        </td>
                                        <td className="px-2 py-2 text-secondary-light text-sm">
                                          {formatRelativeTime(lead.createdAt)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReferralTable;
