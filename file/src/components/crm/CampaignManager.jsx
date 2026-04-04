'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { createCampaign, updateCampaign, pauseCampaign, resumeCampaign, archiveCampaign, previewCampaignEmail } from '@/lib/actions/campaigns';
import { formatDate, formatRelativeTime } from '@/lib/utils/formatters';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
];

const STATUS_BADGE = {
  active: { bg: '#19875422', color: '#198754' },
  paused: { bg: '#ffc10722', color: '#ffc107' },
  archived: { bg: '#6c757d22', color: '#6c757d' },
};

const AUDIENCE_BADGE = {
  clients: { bg: '#0d6efd22', color: '#6ea8fe' },
  leads: { bg: '#6f42c122', color: '#a98eda' },
  all: { bg: '#03FF0022', color: '#03FF00' },
};

const CampaignManager = ({
  initialCampaigns,
  initialTotal,
  initialPage,
  initialPerPage,
  initialSearch,
  initialStatus,
}) => {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    audienceType: 'clients',
    type: 'recurring',
    frequency: 'weekly',
    sendDay: 1,
    sendHour: 15,
    subjectTemplate: '',
    promptContext: '',
    triggerType: '',
    triggerConfig: null,
  });

  const totalPages = Math.ceil(initialTotal / initialPerPage);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    router.push(`/campaigns?${params.toString()}`);
  }, [search, statusFilter, router]);

  const handleFilter = (status) => {
    setStatusFilter(status);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== 'all') params.set('status', status);
    router.push(`/campaigns?${params.toString()}`);
  };

  const openCreate = () => {
    setEditingCampaign(null);
    setForm({
      name: '',
      audienceType: 'clients',
      type: 'recurring',
      frequency: 'weekly',
      sendDay: 1,
      sendHour: 15,
      subjectTemplate: '',
      promptContext: '',
      triggerType: '',
      triggerConfig: null,
    });
    setShowModal(true);
  };

  const openEdit = (campaign) => {
    setEditingCampaign(campaign);
    setForm({
      name: campaign.name,
      audienceType: campaign.audienceType,
      type: campaign.type,
      frequency: campaign.frequency,
      sendDay: campaign.sendDay,
      sendHour: campaign.sendHour,
      subjectTemplate: campaign.subjectTemplate || '',
      promptContext: campaign.promptContext || '',
      triggerType: campaign.triggerType || '',
      triggerConfig: campaign.triggerConfig,
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      ...form,
      triggerType: form.triggerType || null,
      triggerConfig: form.triggerConfig || null,
    };

    let result;
    if (editingCampaign) {
      result = await updateCampaign(editingCampaign.id, data);
    } else {
      result = await createCampaign(data);
    }

    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(editingCampaign ? 'Campaign updated.' : 'Campaign created.');
      setShowModal(false);
      router.refresh();
    }
  };

  const handleAction = async (campaignId, action, label) => {
    setActionLoading(campaignId);
    let result;
    if (action === 'pause') result = await pauseCampaign(campaignId);
    else if (action === 'resume') result = await resumeCampaign(campaignId);
    else if (action === 'archive') result = await archiveCampaign(campaignId);

    setActionLoading(null);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`Campaign ${label}.`);
      router.refresh();
    }
  };

  const handlePreview = async (campaignId) => {
    setPreviewLoading(campaignId);
    const result = await previewCampaignEmail(campaignId);
    setPreviewLoading(null);

    if (result.error) {
      toast.error(result.error);
    } else {
      setPreviewData(result.preview);
    }
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="text-white fw-semibold mb-0">Email Campaigns</h4>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
          New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="d-flex gap-3 mb-4 flex-wrap">
        <div style={{ width: 260 }}>
          <div className="input-group input-group-sm">
            <input
              type="text"
              className="form-control bg-base text-white"
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn btn-primary" onClick={handleSearch}>
              <Icon icon="mdi:magnify" />
            </button>
          </div>
        </div>
        <select
          className="form-select form-select-sm bg-base text-white"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(e) => handleFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Campaign List */}
      {initialCampaigns.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <Icon icon="mdi:email-newsletter" className="text-secondary-light mb-3" style={{ fontSize: '48px' }} />
            <h6 className="text-white">No campaigns yet</h6>
            <p className="text-secondary-light text-sm mb-3">
              Create your first automated email campaign to engage clients and leads.
            </p>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
              Create Campaign
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0">
                <thead>
                  <tr className="text-secondary-light text-xs">
                    <th>Name</th>
                    <th>Audience</th>
                    <th>Type</th>
                    <th>Frequency</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Next Send</th>
                    <th>Last Send</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {initialCampaigns.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/campaigns/${c.id}`} className="text-white text-sm fw-medium text-decoration-none">
                          {c.name}
                        </Link>
                      </td>
                      <td>
                        <span
                          className="badge fw-medium"
                          style={{
                            background: AUDIENCE_BADGE[c.audienceType]?.bg,
                            color: AUDIENCE_BADGE[c.audienceType]?.color,
                          }}
                        >
                          {c.audienceType}
                        </span>
                      </td>
                      <td className="text-secondary-light text-sm">{c.type}</td>
                      <td className="text-secondary-light text-sm">
                        {c.frequency}{c.frequency === 'weekly' || c.frequency === 'biweekly' ? ` (${DAYS[c.sendDay]})` : ''}
                      </td>
                      <td>
                        <span
                          className="badge fw-medium"
                          style={{
                            background: STATUS_BADGE[c.status]?.bg,
                            color: STATUS_BADGE[c.status]?.color,
                          }}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="text-secondary-light text-sm">{Number(c.totalSent) || 0}</td>
                      <td className="text-secondary-light text-sm">
                        {c.nextSendAt ? formatDate(c.nextSendAt) : '—'}
                      </td>
                      <td className="text-secondary-light text-sm">
                        {c.lastGeneratedAt ? formatRelativeTime(c.lastGeneratedAt) : '—'}
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          <button
                            className="btn btn-sm btn-outline-info"
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                            onClick={() => handlePreview(c.id)}
                            disabled={previewLoading === c.id}
                            title="Preview"
                          >
                            {previewLoading === c.id ? (
                              <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10 }} />
                            ) : (
                              <Icon icon="mdi:eye-outline" style={{ fontSize: 14 }} />
                            )}
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                            onClick={() => openEdit(c)}
                            title="Edit"
                          >
                            <Icon icon="mdi:pencil-outline" style={{ fontSize: 14 }} />
                          </button>
                          {c.status === 'active' && (
                            <button
                              className="btn btn-sm btn-outline-warning"
                              style={{ fontSize: '11px', padding: '2px 8px' }}
                              onClick={() => handleAction(c.id, 'pause', 'paused')}
                              disabled={actionLoading === c.id}
                              title="Pause"
                            >
                              {actionLoading === c.id ? (
                                <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10 }} />
                              ) : (
                                <Icon icon="mdi:pause" style={{ fontSize: 14 }} />
                              )}
                            </button>
                          )}
                          {c.status === 'paused' && (
                            <button
                              className="btn btn-sm btn-outline-success"
                              style={{ fontSize: '11px', padding: '2px 8px' }}
                              onClick={() => handleAction(c.id, 'resume', 'resumed')}
                              disabled={actionLoading === c.id}
                              title="Resume"
                            >
                              {actionLoading === c.id ? (
                                <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10 }} />
                              ) : (
                                <Icon icon="mdi:play" style={{ fontSize: 14 }} />
                              )}
                            </button>
                          )}
                          {c.status !== 'archived' && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              style={{ fontSize: '11px', padding: '2px 8px' }}
                              onClick={() => handleAction(c.id, 'archive', 'archived')}
                              disabled={actionLoading === c.id}
                              title="Archive"
                            >
                              <Icon icon="mdi:archive-outline" style={{ fontSize: 14 }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center mt-3 gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/campaigns?page=${p}${search ? `&search=${search}` : ''}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`}
              className={`btn btn-sm ${p === initialPage ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ minWidth: 32 }}
            >
              {p}
            </Link>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowModal(false)}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-white">
                  {editingCampaign ? 'Edit Campaign' : 'New Campaign'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)} />
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-sm-8">
                      <label className="form-label text-secondary-light text-xs">Campaign Name</label>
                      <input
                        type="text"
                        className="form-control bg-base text-white"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                        placeholder="e.g., Weekly Client Digest"
                      />
                    </div>
                    <div className="col-sm-4">
                      <label className="form-label text-secondary-light text-xs">Audience</label>
                      <select
                        className="form-select bg-base text-white"
                        value={form.audienceType}
                        onChange={(e) => setForm({ ...form, audienceType: e.target.value })}
                      >
                        <option value="clients">Clients</option>
                        <option value="leads">Leads</option>
                        <option value="all">All</option>
                      </select>
                    </div>
                    <div className="col-sm-4">
                      <label className="form-label text-secondary-light text-xs">Type</label>
                      <select
                        className="form-select bg-base text-white"
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                      >
                        <option value="recurring">Recurring</option>
                        <option value="event">Event-Triggered</option>
                      </select>
                    </div>

                    {form.type === 'recurring' && (
                      <>
                        <div className="col-sm-4">
                          <label className="form-label text-secondary-light text-xs">Frequency</label>
                          <select
                            className="form-select bg-base text-white"
                            value={form.frequency}
                            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                          >
                            {FREQUENCIES.map((f) => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </select>
                        </div>
                        {(form.frequency === 'weekly' || form.frequency === 'biweekly') && (
                          <div className="col-sm-4">
                            <label className="form-label text-secondary-light text-xs">Send Day</label>
                            <select
                              className="form-select bg-base text-white"
                              value={form.sendDay}
                              onChange={(e) => setForm({ ...form, sendDay: Number(e.target.value) })}
                            >
                              {DAYS.map((d, i) => (
                                <option key={i} value={i}>{d}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    {form.type === 'event' && (
                      <div className="col-sm-4">
                        <label className="form-label text-secondary-light text-xs">Trigger Type</label>
                        <select
                          className="form-select bg-base text-white"
                          value={form.triggerType}
                          onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
                        >
                          <option value="">Select trigger...</option>
                          <option value="anniversary">Company Anniversary</option>
                          <option value="holiday">Holiday</option>
                          <option value="dormant">Dormant Re-engagement</option>
                        </select>
                      </div>
                    )}

                    <div className="col-sm-4">
                      <label className="form-label text-secondary-light text-xs">Send Hour (UTC)</label>
                      <select
                        className="form-select bg-base text-white"
                        value={form.sendHour}
                        onChange={(e) => setForm({ ...form, sendHour: Number(e.target.value) })}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {String(i).padStart(2, '0')}:00 UTC{i === 15 ? ' (9am CST)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label text-secondary-light text-xs">Subject Template</label>
                      <input
                        type="text"
                        className="form-control bg-base text-white"
                        value={form.subjectTemplate}
                        onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })}
                        required
                        placeholder="e.g., Your Weekly Project Update from BotMakers"
                      />
                      <small className="text-secondary-light">AI will personalize this for each recipient.</small>
                    </div>

                    <div className="col-12">
                      <label className="form-label text-secondary-light text-xs">AI Prompt Context</label>
                      <textarea
                        className="form-control bg-base text-white"
                        value={form.promptContext}
                        onChange={(e) => setForm({ ...form, promptContext: e.target.value })}
                        rows={3}
                        placeholder="Instructions for the AI: what should this campaign focus on? e.g., 'Summarize recent project progress and highlight upcoming milestones.'"
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                    {editingCampaign ? 'Save Changes' : 'Create Campaign'}
                  </button>
                </div>
              </form>
            </div>
          </div>
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

export default CampaignManager;
