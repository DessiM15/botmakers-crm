'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { PROPOSAL_STATUSES } from '@/lib/utils/constants';

const ProposalList = ({
  proposals,
  total,
  page,
  perPage,
  totalPages,
  currentStatus,
  currentSearch,
}) => {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const [debounceTimer, setDebounceTimer] = useState(null);

  const updateUrl = useCallback(
    (params) => {
      const url = new URL('/proposals', window.location.origin);
      if (params.status && params.status !== 'all') url.searchParams.set('status', params.status);
      if (params.search) url.searchParams.set('search', params.search);
      if (params.page && params.page > 1) url.searchParams.set('page', params.page);
      router.push(url.pathname + url.search);
    },
    [router]
  );

  const handleSearch = (value) => {
    setSearch(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      updateUrl({ status: currentStatus, search: value, page: 1 });
    }, 300);
    setDebounceTimer(timer);
  };

  const handleStatusChange = (status) => {
    updateUrl({ status, search, page: 1 });
  };

  const handlePageChange = (newPage) => {
    updateUrl({ status: currentStatus, search, page: newPage });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
  };

  return (
    <>
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <h4 className="text-white fw-semibold mb-0">Proposals</h4>
        <Link
          href="/proposals/new"
          className="btn btn-primary d-flex align-items-center gap-1"
        >
          <Icon icon="mdi:plus" style={{ fontSize: '18px' }} />
          New Proposal
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body py-3">
          <div className="row g-3 align-items-center">
            <div className="col-md-6">
              <div className="position-relative">
                <Icon
                  icon="mdi:magnify"
                  className="position-absolute text-secondary-light"
                  style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px' }}
                />
                <input
                  type="text"
                  className="form-control bg-base text-white ps-5"
                  placeholder="Search proposals..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
              <select
                className="form-select bg-base text-white"
                value={currentStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="all">All Statuses</option>
                {PROPOSAL_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 text-end">
              <span className="text-secondary-light text-sm">
                {total} proposal{total !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body p-0">
          {proposals.length === 0 ? (
            <div className="d-flex flex-column justify-content-center align-items-center py-80">
              <Icon
                icon="mdi:file-document-outline"
                className="text-secondary-light mb-2"
                style={{ fontSize: '48px' }}
              />
              <h6 className="text-white fw-semibold mb-2">No proposals yet.</h6>
              <p className="text-secondary-light text-sm mb-3">
                Create your first proposal to get started.
              </p>
              <Link href="/proposals/new" className="btn btn-primary btn-sm">
                <Icon icon="mdi:plus" className="me-1" />
                New Proposal
              </Link>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0">
                <thead>
                  <tr className="text-secondary-light text-xs">
                    <th>Title</th>
                    <th>Client / Lead</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => {
                    const statusObj = PROPOSAL_STATUSES.find((s) => s.value === p.status) || PROPOSAL_STATUSES[0];
                    const recipientName = p.clientName || p.leadName || '—';
                    const recipientCompany = p.clientCompany || '';
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
                          <span className="text-white text-sm">{recipientName}</span>
                          {recipientCompany && (
                            <span className="text-secondary-light text-xs d-block">
                              {recipientCompany}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="text-white text-sm fw-medium">
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
                            {formatDate(p.sentAt)}
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
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center mt-4">
          <nav>
            <ul className="pagination mb-0">
              <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                <button
                  className="page-link bg-base text-white border-secondary-subtle"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </button>
              </li>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <li key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="page-link bg-base text-secondary-light border-secondary-subtle">
                        ...
                      </span>
                    )}
                    <button
                      className={`page-link border-secondary-subtle ${
                        p === page
                          ? 'bg-primary text-white'
                          : 'bg-base text-white'
                      }`}
                      onClick={() => handlePageChange(p)}
                    >
                      {p}
                    </button>
                  </li>
                ))}
              <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                <button
                  className="page-link bg-base text-white border-secondary-subtle"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </>
  );
};

export default ProposalList;
