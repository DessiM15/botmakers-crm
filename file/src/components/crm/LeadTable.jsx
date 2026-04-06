'use client';

import { useState, useCallback, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { updateLeadStage, createLead } from '@/lib/actions/leads';
import {
  PIPELINE_STAGES,
  LEAD_SOURCES,
  LEAD_SCORES,
} from '@/lib/utils/constants';
import { formatRelativeTime } from '@/lib/utils/formatters';
import { arrayToCSV, downloadCSV } from '@/lib/utils/csv-export';

const LeadTable = ({ initialData, teamMembers }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // State from URL params or defaults
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filters, setFilters] = useState({
    source: searchParams.get('source') || 'all',
    score: searchParams.get('score') || 'all',
    stage: searchParams.get('stage') || 'all',
    assignedTo: searchParams.get('assignedTo') || 'all',
  });
  const [page, setPage] = useState(
    parseInt(searchParams.get('page') || '1', 10)
  );
  const [perPage, setPerPage] = useState(
    parseInt(searchParams.get('perPage') || '25', 10)
  );
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Add Lead Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    source: 'other',
    score: '',
    projectType: '',
    projectDetails: '',
    notes: '',
  });
  const [addSaving, setAddSaving] = useState(false);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.fullName.trim() || !addForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setAddSaving(true);
    const payload = {
      ...addForm,
      score: addForm.score || undefined,
    };
    const res = await createLead(payload);
    setAddSaving(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Lead created');
      setAddForm({
        fullName: '',
        email: '',
        phone: '',
        companyName: '',
        source: 'other',
        score: '',
        projectType: '',
        projectDetails: '',
        notes: '',
      });
      setShowAddModal(false);
      router.push(`/leads/${res.lead.id}`);
    }
  };

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Build URL params and navigate to refresh server data
  const navigateWithParams = useCallback(
    (overrides = {}) => {
      const params = new URLSearchParams();
      const newSearch =
        overrides.search !== undefined ? overrides.search : debouncedSearch;
      const newFilters = { ...filters, ...overrides.filters };
      const newPage = overrides.page || 1;
      const newPerPage = overrides.perPage || perPage;

      if (newSearch) params.set('search', newSearch);
      if (newFilters.source !== 'all') params.set('source', newFilters.source);
      if (newFilters.score !== 'all') params.set('score', newFilters.score);
      if (newFilters.stage !== 'all') params.set('stage', newFilters.stage);
      if (newFilters.assignedTo !== 'all')
        params.set('assignedTo', newFilters.assignedTo);
      if (newPage > 1) params.set('page', String(newPage));
      if (newPerPage !== 25) params.set('perPage', String(newPerPage));

      const qs = params.toString();
      router.push(`/leads${qs ? `?${qs}` : ''}`);
    },
    [debouncedSearch, filters, perPage, router]
  );

  // Re-navigate on debounced search change
  useEffect(() => {
    // Only navigate if debounced search differs from the URL param
    const urlSearch = searchParams.get('search') || '';
    if (debouncedSearch !== urlSearch) {
      navigateWithParams({ search: debouncedSearch, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Update local data when initialData changes (from server)
  useEffect(() => {
    setData(initialData);
    setLoading(false);
  }, [initialData]);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setLoading(true);
    navigateWithParams({ filters: newFilters, page: 1 });
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    setLoading(true);
    navigateWithParams({ page: newPage });
  };

  const handlePerPageChange = (value) => {
    const newPerPage = parseInt(value, 10);
    setPerPage(newPerPage);
    setLoading(true);
    navigateWithParams({ perPage: newPerPage, page: 1 });
  };

  const handleStageChange = (leadId, newStage) => {
    // Optimistic update
    setData((prev) => ({
      ...prev,
      leads: prev.leads.map((l) =>
        l.id === leadId ? { ...l, pipelineStage: newStage } : l
      ),
    }));

    startTransition(async () => {
      const res = await updateLeadStage(leadId, newStage);
      if (res?.error) {
        toast.error(res.error);
        // Revert by reloading
        router.refresh();
      } else {
        const label = PIPELINE_STAGES.find((s) => s.value === newStage)?.label;
        toast.success(`Moved to ${label}`);
      }
    });
  };

  const getSourceBadge = (source) => {
    const cfg = LEAD_SOURCES.find((s) => s.value === source);
    if (!cfg) return null;
    return (
      <span
        className="badge text-xs fw-medium"
        style={{ background: 'rgba(13,202,240,0.15)', color: '#0dcaf0' }}
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/export/leads');
      const { rows } = await res.json();
      const csv = arrayToCSV(rows, [
        { label: 'Name', key: 'fullName' },
        { label: 'Email', key: 'email' },
        { label: 'Phone', key: 'phone' },
        { label: 'Company', key: 'companyName' },
        { label: 'Source', key: 'source' },
        { label: 'Stage', key: 'pipelineStage' },
        { label: 'Score', key: 'score' },
        { label: 'Created', accessor: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '' },
      ]);
      downloadCSV(csv, `leads-export-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
    setExporting(false);
  };

  const { leads: rows, total, totalPages } = data;

  return (
    <>
      {/* Search & Filter Bar */}
      <div className="card p-3 mb-4">
        <div className="d-flex flex-wrap align-items-center gap-3">
          {/* Search */}
          <div className="position-relative" style={{ minWidth: '220px' }}>
            <Icon
              icon="mdi:magnify"
              className="position-absolute top-50 translate-middle-y text-secondary-light"
              style={{ left: '10px', fontSize: '18px' }}
            />
            <input
              type="text"
              className="form-control form-control-sm bg-base ps-5"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Source */}
          <select
            className="form-select form-select-sm bg-base"
            style={{ width: '140px' }}
            value={filters.source}
            onChange={(e) => handleFilterChange('source', e.target.value)}
          >
            <option value="all">All Sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Score */}
          <select
            className="form-select form-select-sm bg-base"
            style={{ width: '130px' }}
            value={filters.score}
            onChange={(e) => handleFilterChange('score', e.target.value)}
          >
            <option value="all">All Scores</option>
            {LEAD_SCORES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Stage */}
          <select
            className="form-select form-select-sm bg-base"
            style={{ width: '170px' }}
            value={filters.stage}
            onChange={(e) => handleFilterChange('stage', e.target.value)}
          >
            <option value="all">All Stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Assigned */}
          <select
            className="form-select form-select-sm bg-base"
            style={{ width: '150px' }}
            value={filters.assignedTo}
            onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
          >
            <option value="all">Everyone</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>

          {/* Export + Results count + Add Lead */}
          <div className="d-flex align-items-center gap-2 ms-auto">
            <button className="btn btn-outline-secondary btn-sm" onClick={handleExport} disabled={exporting}>
              {exporting ? <span className="spinner-border spinner-border-sm me-1" /> : <Icon icon="mdi:download" className="me-1" style={{ fontSize: '16px' }} />}
              Export CSV
            </button>
            <span className="text-secondary-light text-sm">
              {total} lead{total !== 1 ? 's' : ''}
            </span>
          </div>

          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-1"
            onClick={() => setShowAddModal(true)}
          >
            <Icon icon="mdi:plus" style={{ fontSize: '16px' }} />
            Add Lead
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        <div className="card-body p-0">
          {rows.length === 0 && !loading ? (
            <div className="d-flex flex-column justify-content-center align-items-center py-80">
              <Icon
                icon="mdi:account-group-outline"
                className="text-secondary-light mb-3"
                style={{ fontSize: '48px' }}
              />
              <h6 className="text-white fw-semibold mb-2">No leads yet</h6>
              <p className="text-secondary-light text-sm mb-0">
                They&apos;ll appear here when someone fills out the contact
                form.
              </p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Name
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Email
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Source
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Score
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Stage
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Assigned To
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <tr key={`skel-${i}`}>
                            {Array.from({ length: 7 }).map((_, j) => (
                              <td key={j} className="px-3 py-3">
                                <div
                                  className="placeholder-glow"
                                  style={{ width: '100%' }}
                                >
                                  <span
                                    className="placeholder rounded"
                                    style={{
                                      width: `${60 + Math.random() * 40}%`,
                                      height: '14px',
                                      display: 'block',
                                      background: 'rgba(255,255,255,0.08)',
                                    }}
                                  />
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))
                      : rows.map((lead) => (
                          <tr
                            key={lead.id}
                            className="cursor-pointer"
                          >
                            <td className="px-3 py-3">
                              <a
                                href={`/leads/${lead.id}`}
                                className="fw-medium text-sm text-decoration-none text-white"
                                onClick={(e) => {
                                  e.preventDefault();
                                  router.push(`/leads/${lead.id}`);
                                }}
                              >
                                {lead.fullName}
                                {lead.companyName && (
                                  <span className="text-secondary-light text-xs d-block mt-1">
                                    {lead.companyName}
                                  </span>
                                )}
                              </a>
                            </td>
                            <td className="px-3 py-3 text-secondary-light text-sm">
                              {lead.email}
                            </td>
                            <td className="px-3 py-3">
                              {getSourceBadge(lead.source)}
                            </td>
                            <td className="px-3 py-3">
                              {getScoreBadge(lead.score)}
                            </td>
                            <td className="px-3 py-3">
                              <select
                                className="form-select form-select-sm text-xs"
                                style={{ width: '150px', padding: '4px 24px 4px 8px' }}
                                value={lead.pipelineStage || 'new_lead'}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleStageChange(lead.id, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {PIPELINE_STAGES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3 text-secondary-light text-sm">
                              {lead.assignedName || '—'}
                            </td>
                            <td className="px-3 py-3 text-secondary-light text-sm">
                              {formatRelativeTime(lead.createdAt)}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex align-items-center justify-content-between px-3 py-3 border-top border-secondary-subtle">
                  <div className="d-flex align-items-center gap-2">
                    <span className="text-secondary-light text-sm">Show</span>
                    <select
                      className="form-select form-select-sm bg-base"
                      style={{ width: '70px' }}
                      value={perPage}
                      onChange={(e) => handlePerPageChange(e.target.value)}
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                    </select>
                    <span className="text-secondary-light text-sm">
                      of {total}
                    </span>
                  </div>

                  <nav>
                    <ul className="pagination pagination-sm mb-0 gap-1">
                      <li
                        className={`page-item ${page <= 1 ? 'disabled' : ''}`}
                      >
                        <button
                          className="page-link bg-base border-0"
                          onClick={() => handlePageChange(page - 1)}
                          disabled={page <= 1}
                        >
                          <Icon icon="mdi:chevron-left" />
                        </button>
                      </li>
                      {Array.from({ length: Math.min(totalPages, 5) }).map(
                        (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (page <= 3) {
                            pageNum = i + 1;
                          } else if (page >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = page - 2 + i;
                          }
                          return (
                            <li
                              key={pageNum}
                              className={`page-item ${pageNum === page ? 'active' : ''}`}
                            >
                              <button
                                className="page-link bg-base border-0"
                                onClick={() => handlePageChange(pageNum)}
                              >
                                {pageNum}
                              </button>
                            </li>
                          );
                        }
                      )}
                      <li
                        className={`page-item ${page >= totalPages ? 'disabled' : ''}`}
                      >
                        <button
                          className="page-link bg-base border-0"
                          onClick={() => handlePageChange(page + 1)}
                          disabled={page >= totalPages}
                        >
                          <Icon icon="mdi:chevron-right" />
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content bg-base">
              <div className="modal-header border-secondary-subtle">
                <h5 className="modal-title text-white fw-semibold">
                  Add Lead
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowAddModal(false)}
                />
              </div>
              <form onSubmit={handleAddSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label text-secondary-light text-sm">
                        Full Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control bg-base text-white"
                        placeholder="John Doe"
                        value={addForm.fullName}
                        onChange={(e) =>
                          setAddForm((prev) => ({ ...prev, fullName: e.target.value }))
                        }
                        disabled={addSaving}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label text-secondary-light text-sm">
                        Email <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className="form-control bg-base text-white"
                        placeholder="john@example.com"
                        value={addForm.email}
                        onChange={(e) =>
                          setAddForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        disabled={addSaving}
                        required
                      />
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label text-secondary-light text-sm">
                        Phone
                      </label>
                      <input
                        type="tel"
                        className="form-control bg-base text-white"
                        placeholder="(555) 123-4567"
                        value={addForm.phone}
                        onChange={(e) =>
                          setAddForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        disabled={addSaving}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label text-secondary-light text-sm">
                        Company
                      </label>
                      <input
                        type="text"
                        className="form-control bg-base text-white"
                        placeholder="Acme Inc."
                        value={addForm.companyName}
                        onChange={(e) =>
                          setAddForm((prev) => ({ ...prev, companyName: e.target.value }))
                        }
                        disabled={addSaving}
                      />
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label text-secondary-light text-sm">
                        Source
                      </label>
                      <select
                        className="form-select bg-base text-white"
                        value={addForm.source}
                        onChange={(e) =>
                          setAddForm((prev) => ({ ...prev, source: e.target.value }))
                        }
                        disabled={addSaving}
                      >
                        {LEAD_SOURCES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label text-secondary-light text-sm">
                        Score
                      </label>
                      <select
                        className="form-select bg-base text-white"
                        value={addForm.score}
                        onChange={(e) =>
                          setAddForm((prev) => ({ ...prev, score: e.target.value }))
                        }
                        disabled={addSaving}
                      >
                        <option value="">No score</option>
                        {LEAD_SCORES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label text-secondary-light text-sm">
                        Project Type
                      </label>
                      <input
                        type="text"
                        className="form-control bg-base text-white"
                        placeholder="e.g. AI Chatbot"
                        value={addForm.projectType}
                        onChange={(e) =>
                          setAddForm((prev) => ({ ...prev, projectType: e.target.value }))
                        }
                        disabled={addSaving}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-secondary-light text-sm">
                      Project Details
                    </label>
                    <textarea
                      className="form-control bg-base text-white"
                      rows={3}
                      placeholder="Brief description of the project..."
                      value={addForm.projectDetails}
                      onChange={(e) =>
                        setAddForm((prev) => ({ ...prev, projectDetails: e.target.value }))
                      }
                      disabled={addSaving}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-secondary-light text-sm">
                      Notes
                    </label>
                    <textarea
                      className="form-control bg-base text-white"
                      rows={2}
                      placeholder="Internal notes..."
                      value={addForm.notes}
                      onChange={(e) =>
                        setAddForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      disabled={addSaving}
                    />
                  </div>
                </div>
                <div className="modal-footer border-secondary-subtle">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowAddModal(false)}
                    disabled={addSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addSaving}
                  >
                    {addSaving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Creating...
                      </>
                    ) : (
                      'Create Lead'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LeadTable;
