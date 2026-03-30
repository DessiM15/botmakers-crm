'use client';

import { useState, useCallback, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';

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
      <style>{`.contact-name-link:hover { color: #03FF00 !important; }`}</style>

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
                        Company
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Phone
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2">
                        Type
                      </th>
                      <th className="text-secondary-light text-xs fw-semibold px-3 py-2" style={{ width: '120px' }}>
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
                              : `/leads/${contact.id}`;
                          return (
                            <tr
                              key={`${contact.type}-${contact.id}`}
                              className="cursor-pointer"
                              onClick={() => router.push(detailHref)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="px-3 py-3">
                                <Link
                                  href={detailHref}
                                  className="fw-medium text-sm contact-name-link"
                                  style={{ color: '#000', textDecoration: 'none' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {contact.fullName}
                                </Link>
                              </td>
                              <td className="px-3 py-3 text-sm" style={{ color: '#000' }}>
                                {contact.email}
                              </td>
                              <td className="px-3 py-3 text-sm" style={{ color: '#000' }}>
                                {contact.company || '—'}
                              </td>
                              <td className="px-3 py-3 text-sm" style={{ color: '#000' }}>
                                {contact.phone || '—'}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={`badge text-xs ${
                                    contact.type === 'client'
                                      ? 'bg-success-600'
                                      : 'bg-info-600'
                                  }`}
                                >
                                  {contact.type === 'client' ? 'Client' : 'Lead'}
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
    </>
  );
};

export default ContactsTable;
