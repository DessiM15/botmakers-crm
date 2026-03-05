'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { EDITABLE_DOC_CATEGORIES } from '@/lib/utils/constants';

const categoryMap = Object.fromEntries(EDITABLE_DOC_CATEGORIES.map((c) => [c.value, c]));

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Full mode: used on /docs page with search, filters, pagination.
 * Compact mode: used in project/client detail Documents tab.
 */
const EditableDocsList = ({
  docs = [],
  total = 0,
  page = 1,
  perPage = 20,
  entityType = '',
  entityId = '',
  showEntityColumn = false,
  compact = false,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [search, setSearch] = useState(searchParams?.get('search') || '');

  // Debounced search for full mode
  useEffect(() => {
    if (compact) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() || '');
      if (search) {
        params.set('search', search);
      } else {
        params.delete('search');
      }
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, compact, router, pathname, searchParams]);

  const handleFilter = useCallback((key, value) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const handlePageChange = useCallback((newPage) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('page', newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const newDocUrl = entityType && entityId
    ? `/docs/new?entity_type=${entityType}&entity_id=${entityId}`
    : '/docs/new';

  // Compact mode — simple card list for project/client detail
  if (compact) {
    return (
      <div>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 className="mb-0">
            <Icon icon="mdi:notebook-edit-outline" className="me-1" />
            Editable Documents
          </h6>
          <a href={newDocUrl} className="btn btn-success btn-sm d-flex align-items-center gap-1">
            <Icon icon="mdi:plus" />
            New Doc
          </a>
        </div>

        {docs.length === 0 ? (
          <div className="text-center py-4 text-secondary-light">
            <Icon icon="mdi:notebook-edit-outline" className="text-4xl mb-2 d-block" />
            <p className="mb-2 text-sm">No editable documents yet</p>
            <a href={newDocUrl} className="btn btn-outline-primary btn-sm">
              Create First Document
            </a>
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {docs.map((doc) => {
              const cat = categoryMap[doc.category] || categoryMap.other;
              return (
                <a
                  key={doc.id}
                  href={`/docs/${doc.id}`}
                  className="card card-body py-12 px-16 text-decoration-none hover-bg-neutral-100"
                  style={{ transition: 'background 0.15s' }}
                >
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                      <Icon icon={cat.icon} className="text-xl text-primary-600" />
                      <span className="fw-medium">{doc.title}</span>
                      <span className="badge bg-neutral-200 text-neutral-600 text-xs">{cat.label}</span>
                      {doc.isPortalVisible && (
                        <Icon icon="mdi:eye-outline" className="text-info text-sm" title="Portal visible" />
                      )}
                    </div>
                    <span className="text-secondary-light text-xs">
                      {formatDate(doc.lastEditedAt)}
                      {doc.updaterName ? ` by ${doc.updaterName}` : doc.creatorName ? ` by ${doc.creatorName}` : ''}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Full mode — search, filter, pagination
  const totalPages = Math.ceil(total / perPage);
  const currentCategory = searchParams?.get('category') || '';
  const currentEntityType = searchParams?.get('entity_type') || '';

  return (
    <div>
      {/* Toolbar */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <div className="position-relative" style={{ minWidth: 220 }}>
            <Icon icon="mdi:magnify" className="position-absolute top-50 start-0 translate-middle-y ms-12 text-secondary-light" />
            <input
              type="text"
              className="form-control ps-40"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={currentCategory}
            onChange={(e) => handleFilter('category', e.target.value)}
          >
            <option value="">All Categories</option>
            {EDITABLE_DOC_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={currentEntityType}
            onChange={(e) => handleFilter('entity_type', e.target.value)}
          >
            <option value="">All Scopes</option>
            <option value="global">Global</option>
            <option value="project">Project</option>
            <option value="client">Client</option>
          </select>
        </div>
        <a href="/docs/new" className="btn btn-success d-flex align-items-center gap-1">
          <Icon icon="mdi:plus" />
          New Document
        </a>
      </div>

      {/* Empty state */}
      {docs.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <Icon icon="mdi:notebook-edit-outline" className="text-6xl text-secondary-light mb-3 d-block mx-auto" />
            <h5 className="mb-2">No documents found</h5>
            <p className="text-secondary-light mb-3">Create your first editable document — specs, meeting notes, SOPs, and more.</p>
            <a href="/docs/new" className="btn btn-success">
              <Icon icon="mdi:plus" className="me-1" />
              New Document
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="card">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Category</th>
                      {showEntityColumn && <th>Scope</th>}
                      <th>Last Edited</th>
                      <th>Portal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc) => {
                      const cat = categoryMap[doc.category] || categoryMap.other;
                      return (
                        <tr
                          key={doc.id}
                          onClick={() => router.push(`/docs/${doc.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <Icon icon={cat.icon} className="text-xl text-primary-600 flex-shrink-0" />
                              <span className="fw-medium">{doc.title}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-neutral-200 text-neutral-600 text-xs">{cat.label}</span>
                          </td>
                          {showEntityColumn && (
                            <td>
                              {doc.entityType === 'global' ? (
                                <span className="text-secondary-light text-sm">Global</span>
                              ) : (
                                <span className="text-sm">
                                  <Icon icon={doc.entityType === 'project' ? 'solar:folder-with-files-outline' : 'mdi:account-tie'} className="me-1" />
                                  {doc.entityName || doc.entityType}
                                </span>
                              )}
                            </td>
                          )}
                          <td>
                            <span className="text-sm">{formatDate(doc.lastEditedAt)}</span>
                            {(doc.updaterName || doc.creatorName) && (
                              <span className="text-secondary-light text-xs d-block">
                                by {doc.updaterName || doc.creatorName}
                              </span>
                            )}
                          </td>
                          <td>
                            {doc.isPortalVisible ? (
                              <Icon icon="mdi:eye-outline" className="text-info" title="Portal visible" />
                            ) : (
                              <Icon icon="mdi:eye-off-outline" className="text-secondary-light" title="Not portal visible" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-secondary-light text-sm">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
              </span>
              <nav>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
                      Prev
                    </button>
                  </li>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <li className="page-item disabled"><span className="page-link">…</span></li>
                        )}
                        <li className={`page-item ${p === page ? 'active' : ''}`}>
                          <button className="page-link" onClick={() => handlePageChange(p)}>{p}</button>
                        </li>
                      </React.Fragment>
                    ))}
                  <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
                      Next
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EditableDocsList;
