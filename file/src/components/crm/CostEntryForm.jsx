'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { createCostEntry, updateCostEntry } from '@/lib/actions/costs';
import { COST_PROVIDERS } from '@/lib/utils/constants';

const CostEntryForm = ({
  show,
  onClose,
  onSuccess,
  clientsList = [],
  projectsList = [],
  initialData = null,
  prefilledClientId = null,
  prefilledProjectId = null,
}) => {
  const isEditing = !!initialData;

  const [form, setForm] = useState({
    provider: '',
    description: '',
    amount: '',
    periodStart: '',
    periodEnd: '',
    clientId: '',
    projectId: '',
  });
  const [saving, setSaving] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState(projectsList);

  useEffect(() => {
    if (initialData) {
      setForm({
        provider: initialData.provider || '',
        description: initialData.description || '',
        amount: initialData.amount || '',
        periodStart: initialData.periodStart || '',
        periodEnd: initialData.periodEnd || '',
        clientId: initialData.clientId || '',
        projectId: initialData.projectId || '',
      });
    } else {
      // Default: current month
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      setForm({
        provider: '',
        description: '',
        amount: '',
        periodStart: `${year}-${month}-01`,
        periodEnd: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
        clientId: prefilledClientId || '',
        projectId: prefilledProjectId || '',
      });
    }
  }, [initialData, show, prefilledClientId, prefilledProjectId]);

  // Filter projects by selected client
  useEffect(() => {
    if (form.clientId) {
      setFilteredProjects(projectsList.filter((p) => p.clientId === form.clientId));
    } else {
      setFilteredProjects(projectsList);
    }
  }, [form.clientId, projectsList]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.provider || !form.description || !form.amount || !form.periodStart || !form.periodEnd) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      clientId: form.clientId || null,
      projectId: form.projectId || null,
      source: 'manual',
    };

    let res;
    if (isEditing) {
      res = await updateCostEntry(initialData.id, payload);
    } else {
      res = await createCostEntry(payload);
    }

    setSaving(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success(isEditing ? 'Cost updated' : 'Cost entry added');
      onSuccess?.();
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div
      className="modal d-block"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content bg-base">
          <div className="modal-header border-secondary-subtle">
            <h6 className="modal-title text-white fw-semibold">
              {isEditing ? 'Edit Cost Entry' : 'Add Cost Entry'}
            </h6>
            <button
              className="btn-close btn-close-white"
              onClick={onClose}
            />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">
                    Provider *
                  </label>
                  <select
                    className="form-select bg-base text-white"
                    value={form.provider}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, provider: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select provider...</option>
                    {COST_PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">
                    Amount (USD) *
                  </label>
                  <input
                    type="number"
                    className="form-control bg-base text-white"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="col-12">
                  <label className="form-label text-secondary-light text-xs">
                    Description *
                  </label>
                  <input
                    type="text"
                    className="form-control bg-base text-white"
                    placeholder="e.g. Vercel Pro — March 2026"
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">
                    Period Start *
                  </label>
                  <input
                    type="date"
                    className="form-control bg-base text-white"
                    value={form.periodStart}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        periodStart: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">
                    Period End *
                  </label>
                  <input
                    type="date"
                    className="form-control bg-base text-white"
                    value={form.periodEnd}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        periodEnd: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">
                    Client (optional)
                  </label>
                  <select
                    className="form-select bg-base text-white"
                    value={form.clientId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        clientId: e.target.value,
                        projectId: '', // Reset project when client changes
                      }))
                    }
                  >
                    <option value="">Unallocated</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                        {c.company ? ` (${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">
                    Project (optional)
                  </label>
                  <select
                    className="form-select bg-base text-white"
                    value={form.projectId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        projectId: e.target.value,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {filteredProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer border-secondary-subtle">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" />
                    Saving...
                  </>
                ) : isEditing ? (
                  'Save Changes'
                ) : (
                  <>
                    <Icon
                      icon="mdi:plus"
                      className="me-1"
                      style={{ fontSize: '16px' }}
                    />
                    Add Cost
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CostEntryForm;
