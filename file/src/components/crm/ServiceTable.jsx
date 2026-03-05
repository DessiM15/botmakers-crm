'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { deleteService } from '@/lib/actions/services';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { SERVICE_CATEGORIES, SERVICE_STATUSES } from '@/lib/utils/constants';
import ServiceForm from './ServiceForm';

const ServiceTable = ({ initialData, summary, clients = [] }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [services, setServices] = useState(initialData.services);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(initialData.page);
  const [perPage] = useState(initialData.perPage);
  const totalPages = Math.ceil(total / perPage);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const updateUrl = useCallback(
    (params) => {
      const sp = new URLSearchParams();
      if (params.search) sp.set('search', params.search);
      if (params.category && params.category !== 'all') sp.set('category', params.category);
      if (params.status && params.status !== 'all') sp.set('status', params.status);
      if (params.page && params.page > 1) sp.set('page', String(params.page));
      router.push(`/services?${sp.toString()}`);
    },
    [router]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      updateUrl({ search, category, status, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleFilterChange = (key, value) => {
    if (key === 'category') setCategory(value);
    if (key === 'status') setStatus(value);
    updateUrl({
      search,
      category: key === 'category' ? value : category,
      status: key === 'status' ? value : status,
      page: 1,
    });
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    updateUrl({ search, category, status, page: newPage });
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete service "${name}"?`)) return;
    const res = await deleteService(id);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Service deleted');
      setServices((prev) => prev.filter((s) => s.id !== id));
      setTotal((prev) => prev - 1);
    }
  };

  const handleSaved = () => {
    router.refresh();
    setEditingService(null);
  };

  return (
    <>
      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-4">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="text-secondary-light text-xs mb-1">Total Monthly Cost</div>
              <div className="text-white text-lg fw-semibold" style={{ color: '#03FF00' }}>
                {formatCurrency(summary.totalMonthlyCost)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="text-secondary-light text-xs mb-1">Active Services</div>
              <div className="text-white text-lg fw-semibold">{summary.activeCount}</div>
            </div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="text-secondary-light text-xs mb-1">Expiring Soon</div>
              <div className="text-lg fw-semibold" style={{ color: summary.expiringCount > 0 ? '#ffc107' : '#fff' }}>
                {summary.expiringCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="flex-grow-1" style={{ minWidth: '200px' }}>
              <input
                type="text"
                className="form-control bg-base text-white"
                placeholder="Search services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-select bg-base text-white"
              style={{ maxWidth: '180px' }}
              value={category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <option value="all">All Categories</option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select
              className="form-select bg-base text-white"
              style={{ maxWidth: '180px' }}
              value={status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="all">All Statuses</option>
              {SERVICE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button
              className="btn btn-primary btn-sm d-flex align-items-center gap-1"
              onClick={() => { setEditingService(null); setShowForm(true); }}
            >
              <Icon icon="mdi:plus" style={{ fontSize: '16px' }} />
              Add Service
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {services.length === 0 ? (
        <div className="card">
          <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
            <Icon icon="mdi:server-network" className="text-secondary-light mb-2" style={{ fontSize: '36px' }} />
            <p className="text-secondary-light text-sm mb-2">No services found.</p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setEditingService(null); setShowForm(true); }}
            >
              <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
              Add First Service
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0">
                <thead>
                  <tr className="text-secondary-light text-xs">
                    <th>Service</th>
                    <th>Client</th>
                    <th>Category</th>
                    <th>Cost</th>
                    <th>Cycle</th>
                    <th>Renewal</th>
                    <th>Status</th>
                    <th style={{ width: '80px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc) => {
                    const statusObj = SERVICE_STATUSES.find((s) => s.value === svc.status) || SERVICE_STATUSES[0];
                    const catObj = SERVICE_CATEGORIES.find((c) => c.value === svc.category);
                    return (
                      <tr key={svc.id}>
                        <td>
                          <div>
                            <span className="text-white text-sm fw-medium d-block">{svc.serviceName}</span>
                            <span className="text-secondary-light text-xs">{svc.provider}</span>
                          </div>
                        </td>
                        <td>
                          <span className="text-white text-sm">{svc.clientName}</span>
                          {svc.projectName && (
                            <span className="text-secondary-light text-xs d-block">{svc.projectName}</span>
                          )}
                        </td>
                        <td>
                          <span className="d-flex align-items-center gap-1 text-secondary-light text-sm">
                            {catObj && <Icon icon={catObj.icon} style={{ fontSize: '14px' }} />}
                            {catObj?.label || svc.category}
                          </span>
                        </td>
                        <td>
                          <span className="text-white text-sm">{formatCurrency(svc.monthlyCost)}</span>
                        </td>
                        <td>
                          <span className="text-secondary-light text-sm">{svc.billingCycle?.replace(/_/g, ' ')}</span>
                        </td>
                        <td>
                          <span className="text-secondary-light text-sm">
                            {svc.renewalDate ? formatDate(svc.renewalDate) : '—'}
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
                          <div className="d-flex gap-1">
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              title="Edit"
                              onClick={() => { setEditingService(svc); setShowForm(true); }}
                            >
                              <Icon icon="mdi:pencil-outline" style={{ fontSize: '14px' }} />
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              title="Delete"
                              onClick={() => handleDelete(svc.id, svc.serviceName)}
                            >
                              <Icon icon="mdi:trash-can-outline" style={{ fontSize: '14px' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="card-footer d-flex align-items-center justify-content-between">
              <span className="text-secondary-light text-xs">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
              </span>
              <div className="d-flex gap-1">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  <Icon icon="mdi:chevron-left" style={{ fontSize: '16px' }} />
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  <Icon icon="mdi:chevron-right" style={{ fontSize: '16px' }} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Service Form Modal */}
      <ServiceForm
        show={showForm}
        onClose={() => { setShowForm(false); setEditingService(null); }}
        onSaved={handleSaved}
        clients={clients}
        service={editingService}
      />
    </>
  );
};

export default ServiceTable;
