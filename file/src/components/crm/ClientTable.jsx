'use client';

import { useState, useCallback, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { createClient } from '@/lib/actions/clients';
import { formatRelativeTime, formatCurrency } from '@/lib/utils/formatters';

const ClientTable = ({ initialData }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(
    parseInt(searchParams.get('page') || '1', 10)
  );
  const [perPage, setPerPage] = useState(
    parseInt(searchParams.get('perPage') || '25', 10)
  );
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Add Client Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    company: '',
    phone: '',
  });
  const [addSaving, setAddSaving] = useState(false);

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
      const newPage = overrides.page || 1;
      const newPerPage = overrides.perPage || perPage;

      if (newSearch) params.set('search', newSearch);
      if (newPage > 1) params.set('page', String(newPage));
      if (newPerPage !== 25) params.set('perPage', String(newPerPage));

      const qs = params.toString();
      router.push(`/clients${qs ? `?${qs}` : ''}`);
    },
    [debouncedSearch, perPage, router]
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

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.fullName.trim() || !addForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setAddSaving(true);
    const res = await createClient(addForm);
    setAddSaving(false);

    if (res?.error) {
      if (res.existingId) {
        toast.error('A client with this email already exists');
      } else {
        toast.error(res.error);
      }
    } else {
      toast.success('Client created');
      setAddForm({ fullName: '', email: '', company: '', phone: '' });
      setShowAddModal(false);
      router.push(`/clients/${res.client.id}`);
    }
  };

  const { clients: rows, total, totalPages } = data;

  return (
    <>
      {/* Search Bar */}
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
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <span className="text-secondary-light text-sm ms-auto">
            {total} client{total !== 1 ? 's' : ''}
          </span>

          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-1"
            onClick={() => setShowAddModal(true)}
          >
            <Icon icon="mdi:plus" style={{ fontSize: '16px' }} />
            Add Client
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
              <h6 className="text-white fw-semibold mb-2">No clients yet</h6>
              <p className="text-secondary-light text-sm mb-3">
                Convert a lead or add one manually.
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddModal(true)}
              >
                <Icon icon="mdi:plus" className="me-1" />
                Add Client
              </button>
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
                        Company
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Email
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Projects
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Open Invoices
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Last Contact
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
                      : rows.map((client) => (
                          <tr key={client.id} className="cursor-pointer">
                            <td className="px-3 py-3">
                              <a
                                href={`/clients/${client.id}`}
                                className="text-white fw-medium text-sm text-decoration-none"
                                onClick={(e) => {
                                  e.preventDefault();
                                  router.push(`/clients/${client.id}`);
                                }}
                              >
                                {client.fullName}
                              </a>
                            </td>
                            <td className="px-3 py-3 text-secondary-light text-sm">
                              {client.company || '—'}
                            </td>
                            <td className="px-3 py-3 text-secondary-light text-sm">
                              {client.email}
                            </td>
                            <td className="px-3 py-3 text-white text-sm">
                              {String(client.projectCount)}
                            </td>
                            <td className="px-3 py-3 text-white text-sm">
                              {formatCurrency(client.openInvoiceTotal)}
                            </td>
                            <td className="px-3 py-3 text-secondary-light text-sm">
                              {client.lastContact
                                ? formatRelativeTime(client.lastContact)
                                : 'Never'}
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

      {/* Add Client Modal */}
      {showAddModal && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-base">
              <div className="modal-header border-secondary-subtle">
                <h5 className="modal-title text-white fw-semibold">
                  Add Client
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowAddModal(false)}
                />
              </div>
              <form onSubmit={handleAddSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label text-secondary-light text-sm">
                      Full Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control bg-base text-white"
                      placeholder="John Doe"
                      value={addForm.fullName}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          fullName: e.target.value,
                        }))
                      }
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
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-secondary-light text-sm">
                      Company
                    </label>
                    <input
                      type="text"
                      className="form-control bg-base text-white"
                      placeholder="Acme Inc."
                      value={addForm.company}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          company: e.target.value,
                        }))
                      }
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
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
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
                      'Create Client'
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

export default ClientTable;
