'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { pauseCampaign, resumeCampaign, archiveCampaign, previewCampaignEmail } from '@/lib/actions/campaigns';
import { formatDate, formatRelativeTime } from '@/lib/utils/formatters';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATUS_BADGE = {
  active: { bg: '#19875422', color: '#198754' },
  paused: { bg: '#ffc10722', color: '#ffc107' },
  archived: { bg: '#6c757d22', color: '#6c757d' },
};

const SEND_STATUS_BADGE = {
  queued: { bg: '#6c757d22', color: '#6c757d' },
  sent: { bg: '#0d6efd22', color: '#6ea8fe' },
  delivered: { bg: '#19875422', color: '#198754' },
  opened: { bg: '#03FF0022', color: '#03FF00' },
  bounced: { bg: '#dc354522', color: '#dc3545' },
  complained: { bg: '#dc354522', color: '#dc3545' },
};

const CampaignDetail = ({ campaign, sends, sendsTotal, sendsPage, sendsTotalPages }) => {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showConfig, setShowConfig] = useState(false);

  const stats = campaign.stats || {};
  const totalSent = Number(stats.sent) || 0;
  const totalDelivered = Number(stats.delivered) || 0;
  const totalOpened = Number(stats.opened) || 0;
  const totalBounced = Number(stats.bounced) || 0;

  const deliveredPct = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : '0.0';
  const openedPct = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0';
  const bouncedPct = totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(1) : '0.0';

  const handleAction = async (action, label) => {
    setActionLoading(action);
    let result;
    if (action === 'pause') result = await pauseCampaign(campaign.id);
    else if (action === 'resume') result = await resumeCampaign(campaign.id);
    else if (action === 'archive') result = await archiveCampaign(campaign.id);
    setActionLoading(null);

    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`Campaign ${label}.`);
      router.refresh();
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    const result = await previewCampaignEmail(campaign.id);
    setPreviewLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      setPreviewData(result.preview);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <Link href="/campaigns" className="btn btn-outline-secondary btn-sm">
          <Icon icon="mdi:arrow-left" style={{ fontSize: 16 }} />
        </Link>
        <div className="flex-grow-1">
          <h4 className="text-white fw-semibold mb-1">{campaign.name}</h4>
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge fw-medium"
              style={{
                background: STATUS_BADGE[campaign.status]?.bg,
                color: STATUS_BADGE[campaign.status]?.color,
              }}
            >
              {campaign.status}
            </span>
            <span className="text-secondary-light text-sm">
              {campaign.type} &middot; {campaign.audienceType} &middot; {campaign.frequency}
              {(campaign.frequency === 'weekly' || campaign.frequency === 'biweekly') ? ` (${DAYS[campaign.sendDay]})` : ''}
              &middot; {String(campaign.sendHour).padStart(2, '0')}:00 UTC
            </span>
          </div>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-info btn-sm"
            onClick={handlePreview}
            disabled={previewLoading}
          >
            {previewLoading ? (
              <span className="spinner-border spinner-border-sm me-1" />
            ) : (
              <Icon icon="mdi:eye-outline" className="me-1" style={{ fontSize: 14 }} />
            )}
            Preview
          </button>
          <Link href={`/campaigns?edit=${campaign.id}`} className="btn btn-outline-secondary btn-sm">
            <Icon icon="mdi:pencil-outline" className="me-1" style={{ fontSize: 14 }} />
            Edit
          </Link>
          {campaign.status === 'active' && (
            <button
              className="btn btn-outline-warning btn-sm"
              onClick={() => handleAction('pause', 'paused')}
              disabled={actionLoading === 'pause'}
            >
              {actionLoading === 'pause' ? <span className="spinner-border spinner-border-sm me-1" /> : null}
              Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              className="btn btn-outline-success btn-sm"
              onClick={() => handleAction('resume', 'resumed')}
              disabled={actionLoading === 'resume'}
            >
              {actionLoading === 'resume' ? <span className="spinner-border spinner-border-sm me-1" /> : null}
              Resume
            </button>
          )}
          {campaign.status !== 'archived' && (
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => handleAction('archive', 'archived')}
              disabled={actionLoading === 'archive'}
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Total Sent', value: totalSent, icon: 'mdi:send', color: '#6ea8fe' },
          { label: 'Delivered', value: `${deliveredPct}%`, icon: 'mdi:check-circle-outline', color: '#198754' },
          { label: 'Opened', value: `${openedPct}%`, icon: 'mdi:email-open-outline', color: '#03FF00' },
          { label: 'Bounced', value: `${bouncedPct}%`, icon: 'mdi:alert-circle-outline', color: '#dc3545' },
        ].map((stat) => (
          <div key={stat.label} className="col-sm-6 col-lg-3">
            <div className="card">
              <div className="card-body d-flex align-items-center gap-3">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                  style={{ width: 44, height: 44, background: `${stat.color}22` }}
                >
                  <Icon icon={stat.icon} style={{ fontSize: 22, color: stat.color }} />
                </div>
                <div>
                  <p className="text-secondary-light text-xs mb-1">{stat.label}</p>
                  <h5 className="text-white fw-semibold mb-0">{stat.value}</h5>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Campaign Config (collapsible) */}
      <div className="card mb-4">
        <div
          className="card-header d-flex align-items-center justify-content-between"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowConfig(!showConfig)}
        >
          <h6 className="text-white fw-semibold mb-0">
            <Icon icon="mdi:cog-outline" className="me-2" style={{ fontSize: 16 }} />
            Campaign Configuration
          </h6>
          <Icon icon={showConfig ? 'mdi:chevron-up' : 'mdi:chevron-down'} className="text-secondary-light" />
        </div>
        {showConfig && (
          <div className="card-body">
            <div className="row g-3">
              <div className="col-sm-6">
                <p className="text-secondary-light text-xs mb-1">Subject Template</p>
                <p className="text-white text-sm mb-0">{campaign.subjectTemplate || '—'}</p>
              </div>
              <div className="col-sm-6">
                <p className="text-secondary-light text-xs mb-1">Created By</p>
                <p className="text-white text-sm mb-0">{campaign.createdByName}</p>
              </div>
              <div className="col-sm-6">
                <p className="text-secondary-light text-xs mb-1">Next Send</p>
                <p className="text-white text-sm mb-0">{campaign.nextSendAt ? formatDate(campaign.nextSendAt) : '—'}</p>
              </div>
              <div className="col-sm-6">
                <p className="text-secondary-light text-xs mb-1">Last Sent</p>
                <p className="text-white text-sm mb-0">{campaign.lastGeneratedAt ? formatRelativeTime(campaign.lastGeneratedAt) : 'Never'}</p>
              </div>
              {campaign.promptContext && (
                <div className="col-12">
                  <p className="text-secondary-light text-xs mb-1">AI Prompt Context</p>
                  <p className="text-white text-sm mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                    {campaign.promptContext}
                  </p>
                </div>
              )}
              {campaign.triggerType && (
                <div className="col-sm-6">
                  <p className="text-secondary-light text-xs mb-1">Trigger Type</p>
                  <p className="text-white text-sm mb-0">{campaign.triggerType}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Send History */}
      <div className="card">
        <div className="card-header">
          <h6 className="text-white fw-semibold mb-0">
            Send History ({sendsTotal})
          </h6>
        </div>
        <div className="card-body p-0">
          {sends.length === 0 ? (
            <div className="text-center py-5">
              <Icon icon="mdi:email-off-outline" className="text-secondary-light mb-2" style={{ fontSize: 32 }} />
              <p className="text-secondary-light text-sm mb-0">No emails sent yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0">
                <thead>
                  <tr className="text-secondary-light text-xs">
                    <th>Recipient</th>
                    <th>Email</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Sent At</th>
                    <th>Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {sends.map((s) => (
                    <tr key={s.id}>
                      <td className="text-white text-sm">{s.recipientName || '—'}</td>
                      <td className="text-secondary-light text-sm">{s.recipientEmail}</td>
                      <td className="text-secondary-light text-sm" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.subject}
                      </td>
                      <td>
                        <span
                          className="badge fw-medium"
                          style={{
                            background: SEND_STATUS_BADGE[s.status]?.bg,
                            color: SEND_STATUS_BADGE[s.status]?.color,
                          }}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="text-secondary-light text-sm">
                        {s.sentAt ? formatRelativeTime(s.sentAt) : '—'}
                      </td>
                      <td className="text-secondary-light text-sm">
                        {s.openedAt ? formatRelativeTime(s.openedAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Send History Pagination */}
      {sendsTotalPages > 1 && (
        <div className="d-flex justify-content-center mt-3 gap-1">
          {Array.from({ length: sendsTotalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/campaigns/${campaign.id}?sendPage=${p}`}
              className={`btn btn-sm ${p === sendsPage ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ minWidth: 32 }}
            >
              {p}
            </Link>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewData && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setPreviewData(null)}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-header border-secondary">
                <div>
                  <h5 className="modal-title text-white mb-1">Email Preview</h5>
                  <p className="text-secondary-light text-sm mb-0">
                    To: {previewData.recipientName} &lt;{previewData.recipientEmail}&gt;
                  </p>
                  <p className="text-secondary-light text-sm mb-0">
                    Subject: {previewData.subject}
                  </p>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setPreviewData(null)} />
              </div>
              <div className="modal-body p-0">
                <iframe
                  srcDoc={previewData.fullHtml}
                  style={{ width: '100%', height: 500, border: 'none', background: '#f0f0f0' }}
                  title="Email Preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CampaignDetail;
