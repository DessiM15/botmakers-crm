'use client';

import { useState, useCallback, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { createLead } from '@/lib/actions/leads';
import { createClient } from '@/lib/actions/clients';
import { inviteTeamMember } from '@/lib/actions/settings';
import { LEAD_SOURCES } from '@/lib/utils/constants';

const ContactsTable = ({ initialData }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [page, setPage] = useState(
    parseInt(searchParams.get('page') || '1', 10)
  );
  const [perPage, setPerPage] = useState(
    parseInt(searchParams.get('perPage') || '25', 10)
  );
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Add Contact Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState('lead');
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    company: '',
    phone: '',
    source: 'other',
  });
  const [addSaving, setAddSaving] = useState(false);

  const resetAddForm = () => {
    setAddForm({ fullName: '', email: '', company: '', phone: '', source: 'other', role: 'member' });
    setAddType('lead');
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.fullName.trim() || !addForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setAddSaving(true);

    let res;
    if (addType === 'lead') {
      res = await createLead({
        fullName: addForm.fullName,
        email: addForm.email,
        phone: addForm.phone || undefined,
        companyName: addForm.company || undefined,
        source: addForm.source,
      });
    } else if (addType === 'client') {
      res = await createClient({
        fullName: addForm.fullName,
        email: addForm.email,
        phone: addForm.phone || undefined,
        company: addForm.company || undefined,
      });
    } else {
      // teammate
      res = await inviteTeamMember(addForm.email, addForm.fullName, addForm.role || 'member');
    }

    setAddSaving(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      const typeLabel = addType === 'lead' ? 'Lead' : addType === 'client' ? 'Client' : 'Teammate';
      toast.success(`${typeLabel} created`);
      resetAddForm();
      setShowAddModal(false);
      if (addType === 'lead' && res.lead?.id) {
        router.push(`/leads/${res.lead.id}`);
      } else if (addType === 'client' && res.client?.id) {
        router.push(`/clients/${res.client.id}`);
      } else {
        router.refresh();
      }
    }
  };

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const navigateWithParams = useCallback(
    (overrides = {}) => {
      const params = new URLSearchParams();
      const newSearch =
        overrides.search !== undefined ? overrides.search : debouncedSearch;
      const newType = overrides.type !== undefined ? overrides.type : typeFilter;
      const newPage = overrides.page || 1;
      const newPerPage = overrides.perPage || perPage;

      if (newSearch) params.set('search', newSearch);
      if (newType && newType !== 'all') params.set('type', newType);
      if (newPage > 1) params.set('page', String(newPage));
      if (newPerPage !== 25) params.set('perPage', String(newPerPage));

      const qs = params.toString();
      router.push(`/contacts${qs ? `?${qs}` : ''}`);
    },
    [debouncedSearch, typeFilter, perPage, router]
  );

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (debouncedSearch !== urlSearch) {
      navigateWithParams({ search: debouncedSearch, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setData(initialData);
    setLoading(false);
  }, [initialData]);

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

  const handleTypeFilter = (type) => {
    setTypeFilter(type);
    setLoading(true);
    navigateWithParams({ type, page: 1 });
  };

  const { contacts: rows, total, totalPages } = data;

  return (
    <>
      <style>{`.contact-name-link:hover { color: #026b3d !important; }`}</style>

      {/* Search & Filters Bar */}
      <div className="card p-3 mb-4">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <div className="position-relative" style={{ minWidth: '220px' }}>
            <Icon
              icon="mdi:magnify"
              className="position-absolute top-50 translate-middle-y text-secondary-light"
              style={{ left: '10px', fontSize: '18px' }}
            />
            <input
              type="text"
              className="form-control form-control-sm bg-base ps-5"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Type filter toggle buttons */}
          <div className="btn-group btn-group-sm">
            {[
              { value: 'all', label: 'All' },
              { value: 'lead', label: 'Leads' },
              { value: 'client', label: 'Clients' },
              { value: 'teammate', label: 'Team' },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`btn ${
                  typeFilter === opt.value
                    ? 'btn-primary-600'
                    : 'btn-outline-neutral-600 text-secondary-light'
                }`}
                onClick={() => handleTypeFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className="text-secondary-light text-sm ms-auto">
            {total} contact{total !== 1 ? 's' : ''}
          </span>

          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-1"
            onClick={() => setShowAddModal(true)}
          >
            <Icon icon="mdi:plus" style={{ fontSize: '16px' }} />
            Add Contact
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        <div className="card-body p-0">
          {rows.length === 0 && !loading ? (
            <div className="d-flex flex-column justify-content-center align-items-center py-80">
              <Icon
                icon="mdi:contacts-outline"
                className="text-secondary-light mb-3"
                style={{ fontSize: '48px' }}
              />
              <h6 className="text-white fw-semibold mb-2">No contacts found</h6>
              <p className="text-secondary-light text-sm mb-3">
                {search || typeFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Add leads or clients to see them here.'}
              </p>
              {!search && typeFilter === 'all' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddModal(true)}
                >
                  <Icon icon="mdi:plus" className="me-1" />
                  Add Contact
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th className="text-xs fw-semibold px-3 py-2" style={{ color: '#111' }}>
                        Name
                      </th>
                      <th className="text-xs fw-semibold px-3 py-2" style={{ color: '#111' }}>
                        Email
                      </th>
                      <th className="text-xs fw-semibold px-3 py-2" style={{ color: '#111' }}>
                        Company
                      </th>
                      <th className="text-xs fw-semibold px-3 py-2" style={{ color: '#111' }}>
                        Phone
                      </th>
                      <th className="text-xs fw-semibold px-3 py-2" style={{ color: '#111' }}>
                        Type
                      </th>
                      <th className="text-xs fw-semibold px-3 py-2" style={{ color: '#111', width: '120px' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <tr key={`skel-${i}`}>
                            {Array.from({ length: 6 }).map((_, j) => (
                              <td key={j} className="px-3 py-3">
                                <div className="placeholder-glow" style={{ width: '100%' }}>
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
                      : rows.map((contact) => {
                          const detailHref =
                            contact.type === 'client'
                              ? `/clients/${contact.id}`
                              : contact.type === 'lead'
                              ? `/leads/${contact.id}`
                              : null;
                          const badgeClass =
                            contact.type === 'client'
                              ? 'bg-success-600'
                              : contact.type === 'teammate'
                              ? 'bg-warning-600'
                              : 'bg-info-600';
                          const badgeLabel =
                            contact.type === 'client'
                              ? 'Client'
                              : contact.type === 'teammate'
                              ? 'Team'
                              : 'Lead';
                          return (
                            <tr
                              key={`${contact.type}-${contact.id}`}
                              className={detailHref ? 'cursor-pointer' : ''}
                              onClick={() => detailHref && router.push(detailHref)}
                              style={detailHref ? { cursor: 'pointer' } : {}}
                            >
                              <td className="px-3 py-3">
                                {detailHref ? (
                                  <Link
                                    href={detailHref}
                                    className="fw-medium text-sm contact-name-link"
                                    style={{ textDecoration: 'none', color: '#1a1a2e' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {contact.fullName}
                                  </Link>
                                ) : (
                                  <span className="fw-medium text-sm" style={{ color: '#1a1a2e' }}>
                                    {contact.fullName}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-sm" style={{ color: '#333' }}>
                                {contact.email}
                              </td>
                              <td className="px-3 py-3 text-sm" style={{ color: '#333' }}>
                                {contact.company || '—'}
                              </td>
                              <td className="px-3 py-3 text-sm" style={{ color: '#333' }}>
                                {contact.phone || '—'}
                              </td>
                              <td className="px-3 py-3">
                                <span className={`badge text-xs ${badgeClass}`}>
                                  {badgeLabel}
                                </span>
                              </td>
                              <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                                <Link
                                  href={`/email-generator?recipient_id=${contact.id}&type=${contact.type}`}
                                  className="btn btn-sm btn-outline-primary-600 d-inline-flex align-items-center gap-1"
                                >
                                  <Icon icon="solar:letter-outline" style={{ fontSize: '14px' }} />
                                  Compose
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
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
                      <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
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

      {/* Add Contact Modal */}
      {showAddModal && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              resetAddForm();
            }
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-base">
              <div className="modal-header border-secondary-subtle">
                <h5 className="modal-title text-white fw-semibold">
                  Add Contact
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => { setShowAddModal(false); resetAddForm(); }}
                />
              </div>
              <form onSubmit={handleAddSubmit}>
                <div className="modal-body">
                  {/* Type toggle */}
                  <div className="mb-3">
                    <label className="form-label text-secondary-light text-sm">
                      Contact Type
                    </label>
                    <div className="btn-group w-100">
                      <button
                        type="button"
                        className={`btn ${addType === 'lead' ? 'btn-info-600' : 'btn-outline-neutral-600 text-secondary-light'}`}
                        onClick={() => setAddType('lead')}
                      >
                        <Icon icon="gridicons:multiple-users" className="me-1" style={{ fontSize: '16px' }} />
                        Lead
                      </button>
                      <button
                        type="button"
                        className={`btn ${addType === 'client' ? 'btn-success-600' : 'btn-outline-neutral-600 text-secondary-light'}`}
                        onClick={() => setAddType('client')}
                      >
                        <Icon icon="mdi:account-tie" className="me-1" style={{ fontSize: '16px' }} />
                        Client
                      </button>
                      <button
                        type="button"
                        className={`btn ${addType === 'teammate' ? 'btn-warning-600' : 'btn-outline-neutral-600 text-secondary-light'}`}
                        onClick={() => setAddType('teammate')}
                      >
                        <Icon icon="mdi:account-group" className="me-1" style={{ fontSize: '16px' }} />
                        Teammate
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary-light text-sm">
                      Full Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control bg-base text-white"
                      placeholder="John Doe"
                      value={addForm.fullName}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, fullName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-secondary-light text-sm">
                      Email <span className="text-danger">*</span>
                    </label>
                    <input
                      type="email"
                      className="form-control bg-base text-white"
                      placeholder="john@example.com"
                      value={addForm.email}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  {addType !== 'teammate' && (
                    <>
                      <div className="mb-3">
                        <label className="form-label text-secondary-light text-sm">
                          Company
                        </label>
                        <input
                          type="text"
                          className="form-control bg-base text-white"
                          placeholder="Acme Inc."
                          value={addForm.company}
                          onChange={(e) => setAddForm((prev) => ({ ...prev, company: e.target.value }))}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label text-secondary-light text-sm">
                          Phone
                        </label>
                        <input
                          type="tel"
                          className="form-control bg-base text-white"
                          placeholder="(555) 123-4567"
                          value={addForm.phone}
                          onChange={(e) => setAddForm((prev) => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                    </>
                  )}

                  {/* Lead-specific: source */}
                  {addType === 'lead' && (
                    <div className="mb-3">
                      <label className="form-label text-secondary-light text-sm">
                        Lead Source
                      </label>
                      <select
                        className="form-select bg-base text-white"
                        value={addForm.source}
                        onChange={(e) => setAddForm((prev) => ({ ...prev, source: e.target.value }))}
                      >
                        {LEAD_SOURCES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Teammate-specific: role */}
                  {addType === 'teammate' && (
                    <div className="mb-3">
                      <label className="form-label text-secondary-light text-sm">
                        Role
                      </label>
                      <select
                        className="form-select bg-base text-white"
                        value={addForm.role || 'member'}
                        onChange={(e) => setAddForm((prev) => ({ ...prev, role: e.target.value }))}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="modal-footer border-secondary-subtle">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => { setShowAddModal(false); resetAddForm(); }}
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
                      `Create ${addType === 'lead' ? 'Lead' : addType === 'client' ? 'Client' : 'Teammate'}`
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

export default ContactsTable;
