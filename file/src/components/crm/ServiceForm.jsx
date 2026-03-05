'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { createService, updateService } from '@/lib/actions/services';
import { SERVICE_CATEGORIES, BILLING_CYCLES, SERVICE_STATUSES } from '@/lib/utils/constants';

const ServiceForm = ({ show, onClose, onSaved, clients = [], service = null, prefilledClientId = null }) => {
  const isEditing = !!service;
  const [submitting, setSubmitting] = useState(false);
  const [clientProjects, setClientProjects] = useState([]);
  const [form, setForm] = useState({
    clientId: '',
    projectId: '',
    serviceName: '',
    provider: '',
    category: 'other',
    monthlyCost: '',
    billingCycle: 'monthly',
    renewalDate: '',
    status: 'active',
    loginUrl: '',
    credentialsVaultUrl: '',
    accountIdentifier: '',
    notes: '',
  });

  useEffect(() => {
    if (service) {
      setForm({
        clientId: service.clientId || '',
        projectId: service.projectId || '',
        serviceName: service.serviceName || '',
        provider: service.provider || '',
        category: service.category || 'other',
        monthlyCost: service.monthlyCost || '',
        billingCycle: service.billingCycle || 'monthly',
        renewalDate: service.renewalDate || '',
        status: service.status || 'active',
        loginUrl: service.loginUrl || '',
        credentialsVaultUrl: service.credentialsVaultUrl || '',
        accountIdentifier: service.accountIdentifier || '',
        notes: service.notes || '',
      });
    } else if (prefilledClientId) {
      setForm((prev) => ({ ...prev, clientId: prefilledClientId }));
    }
  }, [service, prefilledClientId]);

  // Fetch projects when client changes
  useEffect(() => {
    if (!form.clientId) {
      setClientProjects([]);
      return;
    }
    fetch(`/api/invoices/client-projects?clientId=${form.clientId}`)
      .then((r) => r.json())
      .then((data) => setClientProjects(data.projects || []))
      .catch(() => setClientProjects([]));
  }, [form.clientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      ...form,
      monthlyCost: parseFloat(form.monthlyCost) || 0,
      projectId: form.projectId || null,
      loginUrl: form.loginUrl || null,
      credentialsVaultUrl: form.credentialsVaultUrl || null,
      accountIdentifier: form.accountIdentifier || null,
      notes: form.notes || null,
      renewalDate: form.renewalDate || null,
    };

    const res = isEditing
      ? await updateService(service.id, payload)
      : await createService(payload);

    setSubmitting(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success(isEditing ? 'Service updated' : 'Service created');
      onSaved?.(res.service);
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content bg-base">
          <div className="modal-header border-secondary-subtle">
            <h6 className="modal-title text-white fw-semibold">
              {isEditing ? 'Edit Service' : 'Add Service'}
            </h6>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row g-3">
                {/* Client */}
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">Client *</label>
                  <select
                    className="form-select bg-base text-white"
                    value={form.clientId}
                    onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value, projectId: '' }))}
                    required
                    disabled={submitting || !!prefilledClientId}
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}{c.company ? ` (${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Project */}
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">Project (optional)</label>
                  <select
                    className="form-select bg-base text-white"
                    value={form.projectId}
                    onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}
                    disabled={submitting || !form.clientId}
                  >
                    <option value="">None</option>
                    {clientProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Service Name */}
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">Service Name *</label>
                  <input
                    type="text"
                    className="form-control bg-base text-white"
                    placeholder="e.g. Vercel Pro"
                    value={form.serviceName}
                    onChange={(e) => setForm((p) => ({ ...p, serviceName: e.target.value }))}
                    required
                    disabled={submitting}
                  />
                </div>

                {/* Provider */}
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">Provider *</label>
                  <input
                    type="text"
                    className="form-control bg-base text-white"
                    placeholder="e.g. Vercel"
                    value={form.provider}
                    onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                    required
                    disabled={submitting}
                  />
                </div>

                {/* Category */}
                <div className="col-sm-4">
                  <label className="form-label text-secondary-light text-xs">Category</label>
                  <select
                    className="form-select bg-base text-white"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    disabled={submitting}
                  >
                    {SERVICE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Monthly Cost */}
                <div className="col-sm-4">
                  <label className="form-label text-secondary-light text-xs">Monthly Cost ($)</label>
                  <input
                    type="number"
                    className="form-control bg-base text-white"
                    min="0"
                    step="0.01"
                    value={form.monthlyCost}
                    onChange={(e) => setForm((p) => ({ ...p, monthlyCost: e.target.value }))}
                    disabled={submitting}
                  />
                </div>

                {/* Billing Cycle */}
                <div className="col-sm-4">
                  <label className="form-label text-secondary-light text-xs">Billing Cycle</label>
                  <select
                    className="form-select bg-base text-white"
                    value={form.billingCycle}
                    onChange={(e) => setForm((p) => ({ ...p, billingCycle: e.target.value }))}
                    disabled={submitting}
                  >
                    {BILLING_CYCLES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Renewal Date */}
                <div className="col-sm-4">
                  <label className="form-label text-secondary-light text-xs">Renewal Date</label>
                  <input
                    type="date"
                    className="form-control bg-base text-white"
                    value={form.renewalDate}
                    onChange={(e) => setForm((p) => ({ ...p, renewalDate: e.target.value }))}
                    disabled={submitting}
                  />
                </div>

                {/* Status */}
                <div className="col-sm-4">
                  <label className="form-label text-secondary-light text-xs">Status</label>
                  <select
                    className="form-select bg-base text-white"
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    disabled={submitting}
                  >
                    {SERVICE_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Account Identifier */}
                <div className="col-sm-4">
                  <label className="form-label text-secondary-light text-xs">Account ID</label>
                  <input
                    type="text"
                    className="form-control bg-base text-white"
                    placeholder="Account # or username"
                    value={form.accountIdentifier}
                    onChange={(e) => setForm((p) => ({ ...p, accountIdentifier: e.target.value }))}
                    disabled={submitting}
                  />
                </div>

                {/* Login URL */}
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">Login URL</label>
                  <input
                    type="url"
                    className="form-control bg-base text-white"
                    placeholder="https://..."
                    value={form.loginUrl}
                    onChange={(e) => setForm((p) => ({ ...p, loginUrl: e.target.value }))}
                    disabled={submitting}
                  />
                </div>

                {/* Credentials Vault URL */}
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">Credentials Vault URL</label>
                  <input
                    type="url"
                    className="form-control bg-base text-white"
                    placeholder="https://vault.example.com/..."
                    value={form.credentialsVaultUrl}
                    onChange={(e) => setForm((p) => ({ ...p, credentialsVaultUrl: e.target.value }))}
                    disabled={submitting}
                  />
                </div>

                {/* Notes */}
                <div className="col-12">
                  <label className="form-label text-secondary-light text-xs">Notes</label>
                  <textarea
                    className="form-control bg-base text-white"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer border-secondary-subtle">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !form.clientId || !form.serviceName || !form.provider}>
                {submitting ? (
                  <><span className="spinner-border spinner-border-sm me-1" /> Saving...</>
                ) : isEditing ? (
                  'Update Service'
                ) : (
                  'Add Service'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ServiceForm;
