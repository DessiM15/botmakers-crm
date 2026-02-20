'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { sendProposal } from '@/lib/actions/proposals';
import { PROPOSAL_STATUSES } from '@/lib/utils/constants';
import { sanitizeHtml } from '@/lib/utils/sanitize';

const STATUS_FLOW = ['draft', 'sent', 'viewed', 'accepted'];

const ProposalDetail = ({ proposal: initialProposal }) => {
  const router = useRouter();
  const [proposal, setProposal] = useState(initialProposal);
  const [sending, setSending] = useState(false);

  const statusConfig = PROPOSAL_STATUSES.find((s) => s.value === proposal.status) || PROPOSAL_STATUSES[0];
  const recipientName = proposal.clientName || proposal.leadName || 'Unknown';
  const recipientEmail = proposal.clientEmail || proposal.leadEmail || '';
  const lineItems = proposal.lineItems || [];
  const totalAmount = Number(proposal.totalAmount) || 0;

  const handleSend = async () => {
    setSending(true);
    const res = await sendProposal(proposal.id);
    setSending(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Proposal sent!');
      setProposal((prev) => ({
        ...prev,
        status: 'sent',
        sentAt: new Date().toISOString(),
      }));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Back Button */}
      <div className="d-flex align-items-center gap-2 mb-4">
        <button
          className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          onClick={() => router.push('/proposals')}
        >
          <Icon icon="mdi:arrow-left" style={{ fontSize: '16px' }} />
          Proposals
        </button>
      </div>

      {/* Header */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <h4 className="text-white fw-semibold mb-0">{proposal.title}</h4>
        <span
          className="badge fw-medium"
          style={{ background: `${statusConfig.color}22`, color: statusConfig.color }}
        >
          {statusConfig.label}
        </span>
        {proposal.aiGenerated && (
          <span
            className="badge fw-medium"
            style={{ background: 'rgba(13,202,240,0.15)', color: '#0dcaf0' }}
          >
            AI Generated
          </span>
        )}
      </div>

      {/* Status Timeline */}
      <div className="card mb-4">
        <div className="card-body py-3">
          <div className="d-flex align-items-center justify-content-between">
            {STATUS_FLOW.map((st, idx) => {
              const stConfig = PROPOSAL_STATUSES.find((s) => s.value === st);
              const currentIdx = STATUS_FLOW.indexOf(proposal.status);
              const isDeclined = proposal.status === 'declined';
              const isActive = st === proposal.status;
              const isPast = !isDeclined && currentIdx >= idx;
              return (
                <div key={st} className="d-flex align-items-center flex-grow-1">
                  <div className="d-flex flex-column align-items-center" style={{ minWidth: '80px' }}>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center mb-1"
                      style={{
                        width: '32px',
                        height: '32px',
                        background: isPast ? stConfig.color : 'rgba(255,255,255,0.06)',
                        color: isPast ? '#fff' : 'rgba(255,255,255,0.3)',
                      }}
                    >
                      {isPast && !isActive ? (
                        <Icon icon="mdi:check" style={{ fontSize: '16px' }} />
                      ) : (
                        <span className="text-xs fw-medium">{idx + 1}</span>
                      )}
                    </div>
                    <span
                      className="text-xs text-capitalize"
                      style={{ color: isPast ? stConfig.color : 'rgba(255,255,255,0.3)' }}
                    >
                      {stConfig.label}
                    </span>
                  </div>
                  {idx < STATUS_FLOW.length - 1 && (
                    <div
                      className="flex-grow-1"
                      style={{
                        height: '2px',
                        background: isPast && currentIdx > idx ? stConfig.color : 'rgba(255,255,255,0.08)',
                        margin: '0 8px',
                        marginBottom: '18px',
                      }}
                    />
                  )}
                </div>
              );
            })}
            {proposal.status === 'declined' && (
              <div className="d-flex flex-column align-items-center" style={{ minWidth: '80px' }}>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mb-1"
                  style={{ width: '32px', height: '32px', background: '#dc3545', color: '#fff' }}
                >
                  <Icon icon="mdi:close" style={{ fontSize: '16px' }} />
                </div>
                <span className="text-xs text-danger">Declined</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Main Content */}
        <div className="col-xxl-8 col-xl-7">
          {/* Scope */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Scope of Work</h6>
            </div>
            <div className="card-body">
              <div
                className="text-secondary-light proposal-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.scopeOfWork) }}
              />
            </div>
          </div>

          {/* Deliverables */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Deliverables</h6>
            </div>
            <div className="card-body">
              <div
                className="text-secondary-light proposal-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.deliverables) }}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Pricing</h6>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-dark table-bordered mb-0">
                  <thead>
                    <tr className="text-secondary-light text-xs">
                      <th>Description</th>
                      {proposal.pricingType === 'phased' && <th>Phase</th>}
                      <th className="text-end" style={{ width: '80px' }}>Qty</th>
                      <th className="text-end" style={{ width: '120px' }}>Unit Price</th>
                      <th className="text-end" style={{ width: '120px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id}>
                        <td className="text-white text-sm">{item.description}</td>
                        {proposal.pricingType === 'phased' && (
                          <td className="text-secondary-light text-sm">{item.phaseLabel || '—'}</td>
                        )}
                        <td className="text-white text-sm text-end">{item.quantity}</td>
                        <td className="text-white text-sm text-end">
                          ${Number(item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-white text-sm text-end fw-medium">
                          ${Number(item.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td
                        colSpan={proposal.pricingType === 'phased' ? 4 : 3}
                        className="text-end text-white fw-semibold"
                      >
                        Total
                      </td>
                      <td className="text-end text-white fw-bold text-lg">
                        ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Terms & Conditions</h6>
            </div>
            <div className="card-body">
              <div
                className="text-secondary-light proposal-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.termsAndConditions) }}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-xxl-4 col-xl-5">
          {/* Actions */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Actions</h6>
            </div>
            <div className="card-body d-flex flex-column gap-2">
              {proposal.status === 'draft' && (
                <>
                  <button
                    className="btn btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-2"
                    onClick={() => router.push(`/proposals/new?edit_id=${proposal.id}`)}
                  >
                    <Icon icon="mdi:pencil-outline" style={{ fontSize: '18px' }} />
                    Edit Proposal
                  </button>
                  <button
                    className="btn btn-success w-100 d-flex align-items-center justify-content-center gap-2"
                    onClick={handleSend}
                    disabled={sending}
                  >
                    {sending ? (
                      <>
                        <span className="spinner-border spinner-border-sm" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Icon icon="mdi:send" style={{ fontSize: '18px' }} />
                        Send to Client
                      </>
                    )}
                  </button>
                </>
              )}
              {proposal.status === 'accepted' && !proposal.projectId && (
                <button
                  className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
                  onClick={() => router.push(`/projects/new?proposal_id=${proposal.id}`)}
                >
                  <Icon icon="mdi:folder-plus-outline" style={{ fontSize: '18px' }} />
                  Create Project from Proposal
                </button>
              )}
              {proposal.projectId && (
                <button
                  className="btn btn-outline-success w-100 d-flex align-items-center justify-content-center gap-2"
                  onClick={() => router.push(`/projects/${proposal.projectId}`)}
                >
                  <Icon icon="mdi:folder-outline" style={{ fontSize: '18px' }} />
                  View Project
                </button>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Details</h6>
            </div>
            <div className="card-body">
              <div className="d-flex flex-column gap-3">
                <div>
                  <label className="text-secondary-light text-xs d-block mb-1">Recipient</label>
                  <span className="text-white text-sm">{recipientName}</span>
                  {recipientEmail && (
                    <span className="text-secondary-light text-xs d-block">{recipientEmail}</span>
                  )}
                </div>
                <div>
                  <label className="text-secondary-light text-xs d-block mb-1">Pricing Type</label>
                  <span className="text-white text-sm text-capitalize">{proposal.pricingType}</span>
                </div>
                <div>
                  <label className="text-secondary-light text-xs d-block mb-1">Amount</label>
                  <span className="text-white text-sm fw-semibold">
                    ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <label className="text-secondary-light text-xs d-block mb-1">Created</label>
                  <span className="text-white text-sm">{formatDate(proposal.createdAt)}</span>
                </div>
                {proposal.sentAt && (
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">Sent</label>
                    <span className="text-white text-sm">{formatDate(proposal.sentAt)}</span>
                  </div>
                )}
                {proposal.viewedAt && (
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">Viewed</label>
                    <span className="text-white text-sm">{formatDate(proposal.viewedAt)}</span>
                  </div>
                )}
                {proposal.acceptedAt && (
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">Accepted</label>
                    <span className="text-white text-sm">{formatDate(proposal.acceptedAt)}</span>
                  </div>
                )}
                {proposal.declinedAt && (
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">Declined</label>
                    <span className="text-white text-sm">{formatDate(proposal.declinedAt)}</span>
                  </div>
                )}
                {proposal.createdByName && (
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">Created By</label>
                    <span className="text-white text-sm">{proposal.createdByName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Signature Details */}
          {proposal.signedAt && (
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0 d-flex align-items-center gap-2">
                  <Icon icon="mdi:check-decagram" style={{ fontSize: '18px', color: '#03FF00' }} />
                  E-Signature
                </h6>
              </div>
              <div className="card-body">
                <div className="d-flex flex-column gap-3">
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">Signed by</label>
                    <span className="text-white text-sm fst-italic">{proposal.signerName || proposal.clientSignature}</span>
                  </div>
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">Date</label>
                    <span className="text-white text-sm">{formatDate(proposal.signedAt)}</span>
                  </div>
                  {proposal.signerIp && (
                    <div>
                      <label className="text-secondary-light text-xs d-block mb-1">IP Address</label>
                      <span className="text-white text-sm font-monospace">{proposal.signerIp}</span>
                    </div>
                  )}
                  <div className="text-secondary-light text-xs mt-1">
                    Electronically signed via BotMakers CRM
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* View Count */}
          {(proposal.viewedAt || proposal.viewedCount > 0) && (
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0 d-flex align-items-center gap-2">
                  <Icon icon="mdi:eye-outline" style={{ fontSize: '18px', color: '#0d6efd' }} />
                  View Tracking
                </h6>
              </div>
              <div className="card-body">
                <div className="d-flex flex-column gap-2">
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">First viewed</label>
                    <span className="text-white text-sm">{formatDate(proposal.viewedAt)}</span>
                  </div>
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">Total views</label>
                    <span className="text-white text-sm">{proposal.viewedCount || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProposalDetail;
