'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import ProjectCard from './ProjectCard';
import { PROJECT_STATUSES } from '@/lib/utils/constants';

const ProjectList = ({ initialData, clientOptions }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [clientId, setClientId] = useState(searchParams.get('clientId') || 'all');

  const buildUrl = useCallback(
    (overrides = {}) => {
      const params = new URLSearchParams();
      const s = overrides.search ?? search;
      const st = overrides.status ?? status;
      const c = overrides.clientId ?? clientId;

      if (s) params.set('search', s);
      if (st && st !== 'all') params.set('status', st);
      if (c && c !== 'all') params.set('clientId', c);

      const qs = params.toString();
      return qs ? `/projects?${qs}` : '/projects';
    },
    [search, status, clientId]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(buildUrl({ search }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleStatusChange = (val) => {
    setStatus(val);
    router.push(buildUrl({ status: val }));
  };

  const handleClientChange = (val) => {
    setClientId(val);
    router.push(buildUrl({ clientId: val }));
  };

  // Sync with SSR data
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  return (
    <>
      {/* Filters */}
      <div className="row g-3 mb-4">
        <div className="col-lg-4 col-md-6">
          <div className="input-group">
            <span className="input-group-text bg-base text-secondary-light border-secondary-subtle">
              <Icon icon="mdi:magnify" style={{ fontSize: '18px' }} />
            </span>
            <input
              type="text"
              className="form-control bg-base text-white border-secondary-subtle"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="col-lg-3 col-md-3">
          <select
            className="form-select bg-base text-white border-secondary-subtle"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-lg-3 col-md-3">
          <select
            className="form-select bg-base text-white border-secondary-subtle"
            value={clientId}
            onChange={(e) => handleClientChange(e.target.value)}
          >
            <option value="all">All Clients</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}{c.company ? ` (${c.company})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Project Cards */}
      {data.projects.length === 0 ? (
        <div className="card">
          <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
            <Icon
              icon="mdi:folder-outline"
              className="text-secondary-light mb-2"
              style={{ fontSize: '48px' }}
            />
            <p className="text-secondary-light text-md mb-2">No projects yet.</p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => router.push('/projects/new')}
            >
              <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
              New Project
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="row g-3">
            {data.projects.map((project) => (
              <div key={project.id} className="col-xl-4 col-lg-6 col-md-6">
                <ProjectCard project={project} />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="d-flex justify-content-center mt-4">
              <nav>
                <ul className="pagination pagination-sm mb-0">
                  {Array.from({ length: data.totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <li
                        key={p}
                        className={`page-item ${p === data.page ? 'active' : ''}`}
                      >
                        <button
                          className="page-link"
                          onClick={() =>
                            router.push(buildUrl() + (buildUrl().includes('?') ? '&' : '?') + `page=${p}`)
                          }
                        >
                          {p}
                        </button>
                      </li>
                    )
                  )}
                </ul>
              </nav>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default ProjectList;
