'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { updateClient, sendPortalInvite, revokePortalAccess, restorePortalAccess, generatePortalPreviewToken } from '@/lib/actions/clients';
import { formatDate, formatCurrency, formatPhoneNumber } from '@/lib/utils/formatters';
import { PROJECT_STATUSES, PROPOSAL_STATUSES, INVOICE_STATUSES } from '@/lib/utils/constants';

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'mdi:account-outline' },
  { key: 'projects', label: 'Projects', icon: 'mdi:folder-outline' },
  { key: 'proposals', label: 'Proposals', icon: 'mdi:file-document-outline' },
  { key: 'invoices', label: 'Invoices', icon: 'mdi:receipt-text-outline' },
  { key: 'questions', label: 'Questions', icon: 'mdi:help-circle-outline' },
  { key: 'activity', label: 'Activity', icon: 'mdi:timeline-outline' },
];

const PortalAccessCard = ({ client, setClient }) => {
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const handlePreview = async () => {
    setPreviewing(true);
    const res = await generatePortalPreviewToken(client.id);
    setPreviewing(false);
    if (res?.error) {
      toast.error(res.error);
    } else if (res.token) {
      window.open(`/portal/preview?token=${res.token}`, '_blank');
    }
  };

  const handleInvite = async () => {
    setInviting(true);
    const res = await sendPortalInvite(client.id);
    setInviting(false);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Portal invite sent!');
      if (res.warning) {
        toast.warn(res.warning);
      }
      setClient((prev) => ({
        ...prev,
        portalInvitedAt: res.sentAt,
        portalInviteCount: (prev.portalInviteCount || 0) + 1,
        portalAccessRevoked: false,
        authUserId: res.authUserId || prev.authUserId,
      }));
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    const res = await revokePortalAccess(client.id);
    setRevoking(false);
    setShowRevokeConfirm(false);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Portal access revoked');
      setClient((prev) => ({ ...prev, portalAccessRevoked: true }));
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    const res = await restorePortalAccess(client.id);
    setRestoring(false);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Portal access restored');
      setClient((prev) => ({ ...prev, portalAccessRevoked: false }));
    }
  };

  // State: Revoked
  if (client.portalAccessRevoked) {
    return (
      <div className="card mb-4">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h6 className="text-white fw-semibold mb-0">Portal Access</h6>
          <span className="badge fw-medium" style={{ background: 'rgba(220,53,69,0.2)', color: '#dc3545' }}>
            Access Revoked
          </span>
        </div>
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 mb-3">
            <Icon icon="mdi:shield-off-outline" style={{ fontSize: '20px', color: '#dc3545' }} />
            <p className="text-secondary-light text-sm mb-0">
              This client&apos;s portal access has been revoked.
            </p>
          </div>
          <button
            className="btn btn-outline-success btn-sm w-100"
            onClick={handleRestore}
            disabled={restoring}
          >
            {restoring ? (
              <><span className="spinner-border spinner-border-sm me-1" /> Restoring...</>
            ) : (
              <><Icon icon="mdi:shield-check-outline" className="me-1" style={{ fontSize: '16px' }} /> Restore Access</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // State: Not invited
  if (!client.portalInvitedAt) {
    return (
      <div className="card mb-4">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h6 className="text-white fw-semibold mb-0">Portal Access</h6>
          <span className="badge fw-medium" style={{ background: 'rgba(108,117,125,0.2)', color: '#6c757d' }}>
            Not Invited
          </span>
        </div>
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 mb-3">
            <Icon icon="mdi:email-outline" className="text-secondary-light" style={{ fontSize: '20px' }} />
            <p className="text-secondary-light text-sm mb-0">
              Client has not been invited to the portal yet.
            </p>
          </div>
          <button
            className="btn btn-sm w-100 fw-semibold"
            style={{ background: '#03FF00', color: '#033457', border: 'none' }}
            onClick={handleInvite}
            disabled={inviting}
          >
            {inviting ? (
              <><span className="spinner-border spinner-border-sm me-1" /> Sending...</>
            ) : (
              <><Icon icon="mdi:send" className="me-1" style={{ fontSize: '16px' }} /> Send Portal Invite</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // State: Invited but awaiting first login
  if (!client.portalFirstLoginAt) {
    return (
      <div className="card mb-4">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h6 className="text-white fw-semibold mb-0">Portal Access</h6>
          <span className="badge fw-medium" style={{ background: 'rgba(255,193,7,0.2)', color: '#ffc107' }}>
            Awaiting First Login
          </span>
        </div>
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 mb-2">
            <Icon icon="mdi:clock-outline" style={{ fontSize: '20px', color: '#ffc107' }} />
            <p className="text-secondary-light text-sm mb-0">
              Invite sent — waiting for client to log in
            </p>
          </div>
          <div className="d-flex flex-column gap-1 mb-3">
            <span className="text-secondary-light text-xs">
              Invited: {formatDate(client.portalInvitedAt)}
            </span>
            <span className="text-secondary-light text-xs">
              Invites sent: {client.portalInviteCount}
            </span>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-primary btn-sm flex-fill"
              onClick={handleInvite}
              disabled={inviting}
            >
              {inviting ? (
                <><span className="spinner-border spinner-border-sm me-1" /> Sending...</>
              ) : (
                <><Icon icon="mdi:refresh" className="me-1" style={{ fontSize: '14px' }} /> Resend Invite</>
              )}
            </button>
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => setShowRevokeConfirm(true)}
            >
              <Icon icon="mdi:shield-off-outline" style={{ fontSize: '14px' }} />
            </button>
          </div>
          {showRevokeConfirm && (
            <div className="mt-3 p-3 rounded" style={{ background: 'rgba(220,53,69,0.1)', border: '1px solid rgba(220,53,69,0.3)' }}>
              <p className="text-white text-sm mb-2">Revoke portal access for this client?</p>
              <div className="d-flex gap-2">
                <button className="btn btn-danger btn-sm flex-fill" onClick={handleRevoke} disabled={revoking}>
                  {revoking ? <span className="spinner-border spinner-border-sm" /> : 'Confirm Revoke'}
                </button>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowRevokeConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // State: Active — client has logged in
  return (
    <div className="card mb-4">
      <div className="card-header d-flex align-items-center justify-content-between">
        <h6 className="text-white fw-semibold mb-0">Portal Access</h6>
        <span className="badge fw-medium" style={{ background: 'rgba(25,135,84,0.2)', color: '#198754' }}>
          Active
        </span>
      </div>
      <div className="card-body">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Icon icon="mdi:check-circle" className="text-success" style={{ fontSize: '20px' }} />
          <p className="text-white text-sm mb-0 fw-medium">Portal account active</p>
        </div>
        <div className="d-flex flex-column gap-1 mb-3">
          <span className="text-secondary-light text-xs">
            First login: {formatDate(client.portalFirstLoginAt)}
          </span>
          <span className="text-secondary-light text-xs">
            Last login: {formatDate(client.portalLastLoginAt)}
          </span>
        </div>
        <button
          className="btn btn-sm w-100 fw-medium mb-2"
          style={{ background: 'rgba(3,52,87,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
          onClick={handlePreview}
          disabled={previewing}
        >
          {previewing ? (
            <><span className="spinner-border spinner-border-sm me-1" /> Opening...</>
          ) : (
            <><Icon icon="mdi:eye-outline" className="me-1" style={{ fontSize: '16px' }} /> View as Client</>
          )}
        </button>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-primary btn-sm flex-fill"
            onClick={handleInvite}
            disabled={inviting}
          >
            {inviting ? (
              <><span className="spinner-border spinner-border-sm me-1" /> Sending...</>
            ) : (
              <><Icon icon="mdi:refresh" className="me-1" style={{ fontSize: '14px' }} /> Resend Invite</>
            )}
          </button>
          <button
            className="btn btn-outline-danger btn-sm"
            onClick={() => setShowRevokeConfirm(true)}
          >
            <Icon icon="mdi:shield-off-outline" style={{ fontSize: '14px' }} />
          </button>
        </div>
        {showRevokeConfirm && (
          <div className="mt-3 p-3 rounded" style={{ background: 'rgba(220,53,69,0.1)', border: '1px solid rgba(220,53,69,0.3)' }}>
            <p className="text-white text-sm mb-2">Revoke portal access for this client?</p>
            <div className="d-flex gap-2">
              <button className="btn btn-danger btn-sm flex-fill" onClick={handleRevoke} disabled={revoking}>
                {revoking ? <span className="spinner-border spinner-border-sm" /> : 'Confirm Revoke'}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowRevokeConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ClientDetail = ({ client: initialClient, clientProjects = [], clientProposals = [], clientInvoices = [] }) => {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [activeTab, setActiveTab] = useState('overview');
  const [, startTransition] = useTransition();

  // Editable fields
  const [editForm, setEditForm] = useState({
    fullName: client.fullName,
    email: client.email,
    company: client.company || '',
    phone: client.phone || '',
    notes: client.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateClient(client.id, editForm);
    setSaving(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Client updated');
      setClient((prev) => ({
        ...prev,
        ...editForm,
        company: editForm.company || null,
        phone: editForm.phone || null,
        notes: editForm.notes || null,
      }));
    }
  };

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center gap-2 mb-4">
        <button
          className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          onClick={() => router.push('/clients')}
        >
          <Icon icon="mdi:arrow-left" style={{ fontSize: '16px' }} />
          Clients
        </button>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <h4 className="text-white fw-semibold mb-0">{client.fullName}</h4>
        {client.company && (
          <span className="text-secondary-light text-md">{client.company}</span>
        )}
        {client.portalAccessRevoked ? (
          <span className="badge fw-medium" style={{ background: 'rgba(220,53,69,0.2)', color: '#dc3545' }}>
            Portal Revoked
          </span>
        ) : client.portalFirstLoginAt ? (
          <span className="badge fw-medium" style={{ background: 'rgba(25,135,84,0.2)', color: '#198754' }}>
            Portal Active
          </span>
        ) : client.portalInvitedAt ? (
          <span className="badge fw-medium" style={{ background: 'rgba(255,193,7,0.2)', color: '#ffc107' }}>
            Portal Invited
          </span>
        ) : (
          <span className="badge fw-medium" style={{ background: 'rgba(108,117,125,0.2)', color: '#6c757d' }}>
            No Portal Access
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="text-secondary-light text-xs mb-1">Projects</div>
              <div className="text-white text-lg fw-semibold">
                {String(client.projectCount)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="text-secondary-light text-xs mb-1">Proposals</div>
              <div className="text-white text-lg fw-semibold">
                {String(client.proposalCount)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="text-secondary-light text-xs mb-1">Invoices</div>
              <div className="text-white text-lg fw-semibold">
                {String(client.invoiceCount)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="text-secondary-light text-xs mb-1">
                Open Invoices
              </div>
              <div className="text-white text-lg fw-semibold">
                {formatCurrency(client.openInvoiceTotal)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs border-secondary-subtle mb-4">
        {TABS.map((tab) => (
          <li key={tab.key} className="nav-item">
            <button
              className={`nav-link d-flex align-items-center gap-1 ${
                activeTab === tab.key ? 'active' : 'text-secondary-light'
              }`}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom:
                  activeTab === tab.key
                    ? '2px solid #03FF00'
                    : '2px solid transparent',
                color: activeTab === tab.key ? '#03FF00' : undefined,
                padding: '8px 16px',
              }}
            >
              <Icon icon={tab.icon} style={{ fontSize: '16px' }} />
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="row g-4">
          <div className="col-xxl-8 col-xl-7">
            {/* Contact Info (editable) */}
            <div className="card mb-4">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h6 className="text-white fw-semibold mb-0">
                  Contact Information
                </h6>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">
                      Full Name
                    </label>
                    <input
                      type="text"
                      className="form-control bg-base text-white"
                      value={editForm.fullName}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          fullName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">
                      Email
                    </label>
                    <input
                      type="email"
                      className="form-control bg-base text-white"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">
                      Company
                    </label>
                    <input
                      type="text"
                      className="form-control bg-base text-white"
                      value={editForm.company}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          company: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">
                      Phone
                    </label>
                    <input
                      type="tel"
                      className="form-control bg-base text-white"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Notes</h6>
              </div>
              <div className="card-body">
                <textarea
                  className="form-control bg-base text-white"
                  rows={4}
                  placeholder="Add notes about this client..."
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                />
                <p className="text-secondary-light text-xs mt-1 mb-0">
                  Click &quot;Save Changes&quot; to persist
                </p>
              </div>
            </div>
          </div>

          <div className="col-xxl-4 col-xl-5">
            {/* Portal Access — Interactive 4-state card */}
            <PortalAccessCard client={client} setClient={setClient} />

            {/* Linked Lead */}
            {client.linkedLeadId && (
              <div className="card mb-4">
                <div className="card-header">
                  <h6 className="text-white fw-semibold mb-0">Linked Lead</h6>
                </div>
                <div className="card-body">
                  <div className="d-flex align-items-center gap-2">
                    <Icon
                      icon="mdi:account-search-outline"
                      className="text-secondary-light"
                      style={{ fontSize: '20px' }}
                    />
                    <div>
                      <Link
                        href={`/leads/${client.linkedLeadId}`}
                        className="text-white text-sm fw-medium text-decoration-none d-block"
                      >
                        {client.linkedLeadName || 'View Lead'}
                      </Link>
                      <span className="text-secondary-light text-xs">
                        Converted to this client
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Details */}
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Details</h6>
              </div>
              <div className="card-body">
                <div className="d-flex flex-column gap-3">
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">
                      Created
                    </label>
                    <span className="text-white text-sm">
                      {formatDate(client.createdAt)}
                    </span>
                  </div>
                  {client.createdByName && (
                    <div>
                      <label className="text-secondary-light text-xs d-block mb-1">
                        Created By
                      </label>
                      <span className="text-white text-sm">
                        {client.createdByName}
                      </span>
                    </div>
                  )}
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">
                      Last Updated
                    </label>
                    <span className="text-white text-sm">
                      {formatDate(client.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <>
          {clientProjects.length === 0 ? (
            <div className="card">
              <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
                <Icon
                  icon="mdi:folder-outline"
                  className="text-secondary-light mb-2"
                  style={{ fontSize: '36px' }}
                />
                <p className="text-secondary-light text-sm mb-2">
                  No projects yet.
                </p>
                <Link
                  href={`/projects/new?client_id=${client.id}`}
                  className="btn btn-primary btn-sm"
                >
                  <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
                  New Project
                </Link>
              </div>
            </div>
          ) : (
            <div className="row g-3">
              {clientProjects.map((proj) => {
                const totalMs = Number(proj.totalMilestones) || 0;
                const completedMs = Number(proj.completedMilestones) || 0;
                const progress = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;
                const statusObj = PROJECT_STATUSES.find((s) => s.value === proj.status) || PROJECT_STATUSES[0];

                return (
                  <div key={proj.id} className="col-xl-4 col-lg-6">
                    <Link href={`/projects/${proj.id}`} className="text-decoration-none">
                      <div className="card h-100" style={{ cursor: 'pointer' }}>
                        <div className="card-body p-3">
                          <div className="d-flex align-items-start justify-content-between mb-2">
                            <h6 className="text-white fw-semibold mb-0 text-sm">{proj.name}</h6>
                            <span
                              className="badge fw-medium text-xs"
                              style={{ background: `${statusObj.color}20`, color: statusObj.color }}
                            >
                              {statusObj.label}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between text-xs mb-1">
                            <span className="text-secondary-light">Progress</span>
                            <span className="text-white fw-medium">{progress}%</span>
                          </div>
                          <div className="progress" style={{ height: '4px', background: 'rgba(255,255,255,0.1)' }}>
                            <div
                              className="progress-bar"
                              style={{ width: `${progress}%`, background: progress === 100 ? '#198754' : '#03FF00' }}
                            />
                          </div>
                          <p className="text-secondary-light text-xs mt-1 mb-0">
                            {completedMs}/{totalMs} milestones
                            {proj.currentPhase ? ` · ${proj.currentPhase}` : ''}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
              <div className="col-12">
                <Link
                  href={`/projects/new?client_id=${client.id}`}
                  className="btn btn-outline-secondary btn-sm"
                >
                  <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
                  New Project
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'proposals' && (
        <>
          {clientProposals.length === 0 ? (
            <div className="card">
              <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
                <Icon
                  icon="mdi:file-document-outline"
                  className="text-secondary-light mb-2"
                  style={{ fontSize: '36px' }}
                />
                <p className="text-secondary-light text-sm mb-2">
                  No proposals yet.
                </p>
                <Link
                  href={`/proposals/new?client_id=${client.id}`}
                  className="btn btn-primary btn-sm"
                >
                  <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
                  New Proposal
                </Link>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-dark table-hover mb-0">
                    <thead>
                      <tr className="text-secondary-light text-xs">
                        <th>Title</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Sent</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientProposals.map((p) => {
                        const statusObj = PROPOSAL_STATUSES.find((s) => s.value === p.status) || PROPOSAL_STATUSES[0];
                        return (
                          <tr
                            key={p.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => router.push(`/proposals/${p.id}`)}
                          >
                            <td>
                              <span className="text-white text-sm fw-medium">{p.title}</span>
                            </td>
                            <td>
                              <span className="text-white text-sm">
                                {formatCurrency(p.totalAmount)}
                              </span>
                            </td>
                            <td>
                              <span
                                className="badge fw-medium"
                                style={{ background: `${statusObj.color}22`, color: statusObj.color }}
                              >
                                {statusObj.label}
                              </span>
                            </td>
                            <td>
                              <span className="text-secondary-light text-sm">
                                {p.sentAt ? formatDate(p.sentAt) : '—'}
                              </span>
                            </td>
                            <td>
                              <span className="text-secondary-light text-sm">
                                {formatDate(p.createdAt)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card-footer">
                <Link
                  href={`/proposals/new?client_id=${client.id}`}
                  className="btn btn-outline-secondary btn-sm"
                >
                  <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
                  New Proposal
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'invoices' && (
        <>
          {clientInvoices.length === 0 ? (
            <div className="card">
              <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
                <Icon
                  icon="mdi:receipt-text-outline"
                  className="text-secondary-light mb-2"
                  style={{ fontSize: '36px' }}
                />
                <p className="text-secondary-light text-sm mb-2">
                  No invoices yet for this client.
                </p>
                <Link
                  href={`/invoices/new?client_id=${client.id}`}
                  className="btn btn-primary btn-sm"
                >
                  <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
                  Create Invoice
                </Link>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-dark table-hover mb-0">
                    <thead>
                      <tr className="text-secondary-light text-xs">
                        <th>Title</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Due Date</th>
                        <th>Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientInvoices.map((inv) => {
                        const statusObj = INVOICE_STATUSES.find((s) => s.value === inv.status) || INVOICE_STATUSES[0];
                        return (
                          <tr
                            key={inv.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => router.push(`/invoices/${inv.id}`)}
                          >
                            <td>
                              <span className="text-white text-sm fw-medium">{inv.title}</span>
                            </td>
                            <td>
                              <span className="text-white text-sm fw-medium">
                                {formatCurrency(inv.amount)}
                              </span>
                            </td>
                            <td>
                              <span
                                className="badge fw-medium"
                                style={{ background: `${statusObj.color}22`, color: statusObj.color }}
                              >
                                {statusObj.label}
                              </span>
                            </td>
                            <td>
                              <span className="text-secondary-light text-sm">
                                {inv.dueDate ? formatDate(inv.dueDate) : '—'}
                              </span>
                            </td>
                            <td>
                              <span className="text-secondary-light text-sm">
                                {inv.paidAt ? formatDate(inv.paidAt) : '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card-footer">
                <Link
                  href={`/invoices/new?client_id=${client.id}`}
                  className="btn btn-outline-secondary btn-sm"
                >
                  <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
                  New Invoice
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'questions' && (
        <div className="card">
          <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
            <Icon
              icon="mdi:help-circle-outline"
              className="text-secondary-light mb-2"
              style={{ fontSize: '36px' }}
            />
            <p className="text-secondary-light text-sm mb-0">
              Client questions will appear here once the portal is live (Stage
              12).
            </p>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="card">
          <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
            <Icon
              icon="mdi:timeline-outline"
              className="text-secondary-light mb-2"
              style={{ fontSize: '36px' }}
            />
            <p className="text-secondary-light text-sm mb-0">
              Activity log for this client will be shown here (Stage 12).
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientDetail;
