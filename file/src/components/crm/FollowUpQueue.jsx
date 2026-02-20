'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import Link from 'next/link';
import { approveAndSendFollowUp, dismissFollowUp } from '@/lib/actions/follow-ups';
import { formatRelativeTime } from '@/lib/utils/formatters';
import { PIPELINE_STAGES } from '@/lib/utils/constants';

const FollowUpQueue = ({ followUps: initialFollowUps }) => {
  const [followUps, setFollowUps] = useState(initialFollowUps);
  const [previewId, setPreviewId] = useState(null);
  const [, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState(null);

  const previewItem = followUps.find((f) => f.id === previewId);

  const handleApprove = async (id) => {
    setLoadingId(id);
    const res = await approveAndSendFollowUp(id);
    setLoadingId(null);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Follow-up email sent!');
      setFollowUps((prev) => prev.filter((f) => f.id !== id));
      setPreviewId(null);
    }
  };

  const handleDismiss = async (id) => {
    setLoadingId(id);
    const res = await dismissFollowUp(id);
    setLoadingId(null);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Follow-up dismissed');
      setFollowUps((prev) => prev.filter((f) => f.id !== id));
      setPreviewId(null);
    }
  };

  const isDue = (remindAt) => new Date(remindAt) <= new Date();

  return (
    <>
      <div className="card h-100">
        <div className="card-header border-bottom d-flex align-items-center justify-content-between">
          <h6 className="text-lg fw-semibold mb-0">
            Follow-Up Queue
            {followUps.length > 0 && (
              <span className="badge bg-warning text-dark ms-2 text-xs">
                {followUps.length}
              </span>
            )}
          </h6>
          <Icon icon="mdi:bell-ring-outline" className="text-warning" style={{ fontSize: '20px' }} />
        </div>
        <div className="card-body">
          {followUps.length === 0 ? (
            <div className="text-center py-4">
              <Icon
                icon="mdi:check-circle-outline"
                className="text-success mb-2"
                style={{ fontSize: '36px' }}
              />
              <p className="text-secondary-light text-sm mb-0">
                No pending follow-ups
              </p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {followUps.map((item) => {
                const stageConfig = PIPELINE_STAGES.find(
                  (s) => s.value === item.pipelineStage
                );
                const due = isDue(item.remindAt);
                const hasDraft = !!item.aiDraftSubject;

                return (
                  <div
                    key={item.id}
                    className="border rounded-3 p-3"
                    style={{
                      borderColor: due
                        ? 'rgba(255,193,7,0.3)'
                        : 'rgba(255,255,255,0.08)',
                      background: due
                        ? 'rgba(255,193,7,0.05)'
                        : 'transparent',
                    }}
                  >
                    <div className="d-flex align-items-start justify-content-between mb-2">
                      <div>
                        <Link
                          href={`/leads/${item.leadId}`}
                          className="text-white fw-medium text-sm text-decoration-none"
                        >
                          {item.leadName}
                        </Link>
                        {item.leadCompany && (
                          <span className="text-secondary-light text-xs ms-2">
                            {item.leadCompany}
                          </span>
                        )}
                      </div>
                      {stageConfig && (
                        <span
                          className="badge text-xs"
                          style={{
                            background: `${stageConfig.color}22`,
                            color: stageConfig.color,
                          }}
                        >
                          {stageConfig.label}
                        </span>
                      )}
                    </div>

                    <p className="text-secondary-light text-xs mb-2">
                      {item.triggerReason}
                      {due && (
                        <span className="text-warning ms-2">
                          — Due {formatRelativeTime(item.remindAt)}
                        </span>
                      )}
                      {!due && (
                        <span className="ms-2">
                          — Due {formatRelativeTime(item.remindAt)}
                        </span>
                      )}
                    </p>

                    <div className="d-flex gap-2">
                      {hasDraft && (
                        <button
                          className="btn btn-sm btn-outline-info d-flex align-items-center gap-1"
                          onClick={() => setPreviewId(item.id)}
                        >
                          <Icon icon="mdi:eye-outline" style={{ fontSize: '14px' }} />
                          Preview
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-success d-flex align-items-center gap-1"
                        onClick={() => handleApprove(item.id)}
                        disabled={!hasDraft || loadingId === item.id}
                      >
                        {loadingId === item.id ? (
                          <span className="spinner-border spinner-border-sm" />
                        ) : (
                          <Icon icon="mdi:send" style={{ fontSize: '14px' }} />
                        )}
                        {hasDraft ? 'Send' : 'Drafting...'}
                      </button>
                      <Link
                        href={`/email-generator?to=${encodeURIComponent(item.leadEmail)}&name=${encodeURIComponent(item.leadName)}&category=follow_up`}
                        className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                      >
                        <Icon icon="mdi:pencil" style={{ fontSize: '14px' }} />
                        Edit
                      </Link>
                      <button
                        className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                        onClick={() => handleDismiss(item.id)}
                        disabled={loadingId === item.id}
                      >
                        <Icon icon="mdi:close" style={{ fontSize: '14px' }} />
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewId(null);
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content bg-base">
              <div className="modal-header border-secondary-subtle">
                <h5 className="modal-title text-white fw-semibold">
                  AI Draft Preview
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setPreviewId(null)}
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="text-secondary-light text-xs d-block mb-1">
                    To
                  </label>
                  <span className="text-white text-sm">
                    {previewItem.leadName} &lt;{previewItem.leadEmail}&gt;
                  </span>
                </div>
                <div className="mb-3">
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Subject
                  </label>
                  <span className="text-white text-sm">
                    {previewItem.aiDraftSubject}
                  </span>
                </div>
                <div className="mb-3">
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Body
                  </label>
                  <div
                    className="border rounded p-3"
                    style={{
                      background: '#fff',
                      color: '#333',
                      maxHeight: '400px',
                      overflow: 'auto',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: previewItem.aiDraftBodyHtml,
                    }}
                  />
                </div>
              </div>
              <div className="modal-footer border-secondary-subtle">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setPreviewId(null)}
                >
                  Close
                </button>
                <Link
                  href={`/email-generator?to=${encodeURIComponent(previewItem.leadEmail)}&name=${encodeURIComponent(previewItem.leadName)}&category=follow_up`}
                  className="btn btn-outline-primary"
                >
                  Edit in Email Generator
                </Link>
                <button
                  className="btn btn-success"
                  onClick={() => handleApprove(previewItem.id)}
                  disabled={loadingId === previewItem.id}
                >
                  {loadingId === previewItem.id ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:send" className="me-1" />
                      Approve &amp; Send
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FollowUpQueue;
