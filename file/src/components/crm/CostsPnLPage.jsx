'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { COST_SOURCES } from '@/lib/utils/constants';
import { deleteCostEntry, allocateCostToProject, allocateCostToClient } from '@/lib/actions/costs';
import CostEntryForm from './CostEntryForm';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const TABS = [
  { key: 'all', label: 'All Costs', icon: 'mdi:format-list-bulleted' },
  { key: 'unallocated', label: 'Unallocated', icon: 'mdi:help-circle-outline' },
];

const CostsPnLPage = ({
  costData,
  pnl,
  trend,
  breakdown,
  clientsList,
  projectsList,
  initialTab,
  initialSearch,
  initialSource,
  initialPage,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(initialTab || 'all');
  const [search, setSearch] = useState(initialSearch || '');
  const [source, setSource] = useState(initialSource || 'all');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const items = costData?.items || [];
  const total = costData?.total || 0;
  const page = costData?.page || 1;
  const perPage = costData?.perPage || 25;
  const totalPages = Math.ceil(total / perPage);

  const unallocatedItems = items.filter((i) => !i.projectId && !i.clientId);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (source !== 'all') params.set('source', source);
    router.push(`/costs?${params.toString()}`);
  }, [search, source, router]);

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (source !== 'all') params.set('source', source);
    params.set('page', String(newPage));
    router.push(`/costs?${params.toString()}`);
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    const res = await deleteCostEntry(id);
    setDeleting(null);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Cost entry deleted');
      router.refresh();
    }
  };

  const handleAllocateProject = async (costId, projectId) => {
    const res = await allocateCostToProject(costId, projectId);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Cost allocated to project');
      router.refresh();
    }
  };

  const handleAllocateClient = async (costId, clientId) => {
    const res = await allocateCostToClient(costId, clientId);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Cost allocated to client');
      router.refresh();
    }
  };

  // Chart config: Monthly Revenue vs Costs
  const trendChartOptions = {
    chart: {
      type: 'bar',
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'Inter Tight, sans-serif',
    },
    theme: { mode: 'dark' },
    colors: ['#198754', '#dc3545', '#0d6efd'],
    plotOptions: {
      bar: { columnWidth: '60%', borderRadius: 3 },
    },
    xaxis: {
      categories: (trend || []).map((t) => {
        const [y, m] = t.month.split('-');
        return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'short' });
      }),
      labels: { style: { colors: '#9ca3af' } },
    },
    yaxis: {
      labels: {
        style: { colors: '#9ca3af' },
        formatter: (val) => `$${(val / 1000).toFixed(1)}k`,
      },
    },
    grid: { borderColor: 'rgba(255,255,255,0.08)' },
    legend: { position: 'top', labels: { colors: '#9ca3af' } },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val) => formatCurrency(val) },
    },
    stroke: { width: [0, 0, 2], curve: 'smooth' },
  };

  const trendChartSeries = [
    { name: 'Revenue', type: 'bar', data: (trend || []).map((t) => t.revenue) },
    { name: 'Costs', type: 'bar', data: (trend || []).map((t) => t.costs) },
    { name: 'Profit', type: 'line', data: (trend || []).map((t) => t.profit) },
  ];

  // Donut chart
  const donutOptions = {
    chart: { type: 'donut', background: 'transparent', fontFamily: 'Inter Tight, sans-serif' },
    theme: { mode: 'dark' },
    labels: (breakdown || []).map((b) => b.provider),
    colors: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#0dcaf0', '#fd7e14', '#6c757d', '#03FF00'],
    legend: { position: 'bottom', labels: { colors: '#9ca3af' } },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val) => formatCurrency(val) },
    },
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              formatter: (w) => formatCurrency(w.globals.seriesTotals.reduce((a, b) => a + b, 0)),
              color: '#fff',
            },
            value: { color: '#fff' },
          },
        },
      },
    },
    dataLabels: { enabled: false },
  };

  const donutSeries = (breakdown || []).map((b) => b.total);

  const getSourceBadge = (sourceVal) => {
    const src = COST_SOURCES.find((s) => s.value === sourceVal);
    if (!src) return null;
    const isAuto = sourceVal !== 'manual';
    return (
      <span
        className="badge fw-medium d-inline-flex align-items-center gap-1"
        style={{
          background: isAuto ? 'rgba(25,135,84,0.15)' : 'rgba(108,117,125,0.15)',
          color: isAuto ? '#198754' : '#6c757d',
        }}
      >
        <Icon icon={src.icon} style={{ fontSize: '12px' }} />
        {src.label}
      </span>
    );
  };

  const renderCostTable = (costItems, showAllocate = false) => {
    if (costItems.length === 0) {
      return (
        <div className="card">
          <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
            <Icon icon="mdi:chart-box-outline" className="text-secondary-light mb-2" style={{ fontSize: '36px' }} />
            <p className="text-secondary-light text-sm mb-2">No cost entries yet.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
              Add Cost
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-dark table-hover mb-0">
              <thead>
                <tr className="text-secondary-light text-xs">
                  <th>Provider</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Period</th>
                  {!showAllocate && <th>Project</th>}
                  {!showAllocate && <th>Client</th>}
                  <th>Source</th>
                  {showAllocate && <th>Allocate</th>}
                  <th style={{ width: '80px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {costItems.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span className="text-white text-sm fw-medium">{entry.provider}</span>
                    </td>
                    <td>
                      <span className="text-secondary-light text-sm">{entry.description}</span>
                    </td>
                    <td>
                      <span className="text-white text-sm fw-medium">{formatCurrency(entry.amount)}</span>
                    </td>
                    <td>
                      <span className="text-secondary-light text-xs">
                        {formatDate(entry.periodStart)} — {formatDate(entry.periodEnd)}
                      </span>
                    </td>
                    {!showAllocate && (
                      <td>
                        {entry.projectName ? (
                          <Link href={`/projects/${entry.projectId}`} className="text-white text-sm text-decoration-none">
                            {entry.projectName}
                          </Link>
                        ) : (
                          <span className="text-secondary-light text-xs">—</span>
                        )}
                      </td>
                    )}
                    {!showAllocate && (
                      <td>
                        {entry.clientName ? (
                          <Link href={`/clients/${entry.clientId}`} className="text-white text-sm text-decoration-none">
                            {entry.clientName}
                          </Link>
                        ) : (
                          <span className="text-secondary-light text-xs">—</span>
                        )}
                      </td>
                    )}
                    <td>{getSourceBadge(entry.source)}</td>
                    {showAllocate && (
                      <td>
                        <div className="d-flex gap-1">
                          <select
                            className="form-select form-select-sm bg-base text-white"
                            style={{ maxWidth: '120px', fontSize: '11px' }}
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) handleAllocateClient(entry.id, e.target.value);
                            }}
                          >
                            <option value="">Client...</option>
                            {clientsList.map((c) => (
                              <option key={c.id} value={c.id}>{c.fullName}</option>
                            ))}
                          </select>
                          <select
                            className="form-select form-select-sm bg-base text-white"
                            style={{ maxWidth: '120px', fontSize: '11px' }}
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) handleAllocateProject(entry.id, e.target.value);
                            }}
                          >
                            <option value="">Project...</option>
                            {projectsList.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    )}
                    <td>
                      {entry.source === 'manual' && (
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-outline-secondary btn-sm px-2 py-1"
                            title="Edit"
                            onClick={() => {
                              setEditingEntry(entry);
                              setShowForm(true);
                            }}
                          >
                            <Icon icon="mdi:pencil-outline" style={{ fontSize: '14px' }} />
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm px-2 py-1"
                            title="Delete"
                            disabled={deleting === entry.id}
                            onClick={() => handleDelete(entry.id)}
                          >
                            {deleting === entry.id ? (
                              <span className="spinner-border spinner-border-sm" style={{ width: '14px', height: '14px' }} />
                            ) : (
                              <Icon icon="mdi:trash-can-outline" style={{ fontSize: '14px' }} />
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <h4 className="text-white fw-semibold mb-0">Costs &amp; P&amp;L</h4>
        <button
          className="btn btn-primary btn-sm d-flex align-items-center gap-1"
          onClick={() => {
            setEditingEntry(null);
            setShowForm(true);
          }}
        >
          <Icon icon="mdi:plus" style={{ fontSize: '16px' }} />
          Add Cost
        </button>
      </div>

      {/* P&L Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="d-flex align-items-center gap-2 mb-1">
                <Icon icon="mdi:cash-multiple" style={{ fontSize: '20px', color: '#198754' }} />
                <span className="text-secondary-light text-xs">Total Revenue</span>
              </div>
              <div className="text-lg fw-semibold" style={{ color: '#198754' }}>
                {formatCurrency(pnl.revenue)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="d-flex align-items-center gap-2 mb-1">
                <Icon icon="mdi:trending-down" style={{ fontSize: '20px', color: '#dc3545' }} />
                <span className="text-secondary-light text-xs">Total Costs</span>
              </div>
              <div className="text-lg fw-semibold" style={{ color: '#dc3545' }}>
                {formatCurrency(pnl.costs)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="d-flex align-items-center gap-2 mb-1">
                <Icon icon="mdi:chart-line" style={{ fontSize: '20px', color: pnl.profit >= 0 ? '#0d6efd' : '#dc3545' }} />
                <span className="text-secondary-light text-xs">Gross Profit</span>
              </div>
              <div className="text-lg fw-semibold" style={{ color: pnl.profit >= 0 ? '#0d6efd' : '#dc3545' }}>
                {formatCurrency(pnl.profit)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="d-flex align-items-center gap-2 mb-1">
                <Icon icon="mdi:percent-outline" style={{ fontSize: '20px', color: '#6f42c1' }} />
                <span className="text-secondary-light text-xs">Margin</span>
              </div>
              <div className="text-lg fw-semibold" style={{ color: '#6f42c1' }}>
                {pnl.margin.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="row g-3 mb-4">
        <div className="col-lg-7">
          <div className="card">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Monthly Revenue vs Costs</h6>
            </div>
            <div className="card-body">
              {trend && trend.length > 0 ? (
                <Chart
                  options={trendChartOptions}
                  series={trendChartSeries}
                  type="bar"
                  height={300}
                />
              ) : (
                <p className="text-secondary-light text-sm text-center py-5 mb-0">No data yet</p>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Cost Breakdown by Provider</h6>
            </div>
            <div className="card-body">
              {breakdown && breakdown.length > 0 ? (
                <Chart
                  options={donutOptions}
                  series={donutSeries}
                  type="donut"
                  height={300}
                />
              ) : (
                <p className="text-secondary-light text-sm text-center py-5 mb-0">No data yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs border-secondary-subtle mb-4">
        {TABS.map((tab) => (
          <li key={tab.key} className="nav-item">
            <button
              className={`nav-link d-flex align-items-center gap-1 ${
                activeTab === tab.key ? 'active' : 'text-secondary-light'
              }`}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom:
                  activeTab === tab.key
                    ? '2px solid #03FF00'
                    : '2px solid transparent',
                color: activeTab === tab.key ? '#03FF00' : undefined,
                padding: '8px 16px',
              }}
            >
              <Icon icon={tab.icon} style={{ fontSize: '16px' }} />
              {tab.label}
              {tab.key === 'unallocated' && unallocatedItems.length > 0 && (
                <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '10px' }}>
                  {unallocatedItems.length}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {/* Search / Filter (All Costs tab) */}
      {activeTab === 'all' && (
        <>
          <form onSubmit={handleSearch} className="d-flex gap-2 mb-3">
            <input
              type="text"
              className="form-control form-control-sm bg-base text-white"
              placeholder="Search costs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: '250px' }}
            />
            <select
              className="form-select form-select-sm bg-base text-white"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                const params = new URLSearchParams();
                if (search) params.set('search', search);
                if (e.target.value !== 'all') params.set('source', e.target.value);
                router.push(`/costs?${params.toString()}`);
              }}
              style={{ maxWidth: '160px' }}
            >
              <option value="all">All Sources</option>
              {COST_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-outline-secondary btn-sm">
              Search
            </button>
          </form>

          {renderCostTable(items)}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-secondary-light text-sm">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
              </span>
              <div className="d-flex gap-1">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Prev
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Unallocated Tab */}
      {activeTab === 'unallocated' && renderCostTable(unallocatedItems, true)}

      {/* Cost Entry Form Modal */}
      <CostEntryForm
        show={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingEntry(null);
        }}
        onSuccess={() => router.refresh()}
        clientsList={clientsList}
        projectsList={projectsList}
        initialData={editingEntry}
      />
    </>
  );
};

export default CostsPnLPage;
