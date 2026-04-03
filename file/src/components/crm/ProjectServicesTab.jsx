'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import { confirmDetectedServices, addManualProjectService, removeProjectService, updateService } from '@/lib/actions/services';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { SERVICE_CATEGORIES, SERVICE_STATUSES, COST_PROVIDERS, DEFAULT_SERVICE_PRICING } from '@/lib/utils/constants';

const CONFIDENCE_BADGES = {
  high: { label: 'High', color: '#198754', bg: 'rgba(25,135,84,0.15)' },
  medium: { label: 'Medium', color: '#ffc107', bg: 'rgba(255,193,7,0.15)' },
  low: { label: 'Low', color: '#dc3545', bg: 'rgba(220,53,69,0.15)' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const ProjectServicesTab = ({ projectId, services = [], hasRepos = false }) => {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ serviceName: '', provider: '', category: 'other', monthlyCost: '0' });
  const [addSaving, setAddSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [editingCostId, setEditingCostId] = useState(null);
  const [editingCostValue, setEditingCostValue] = useState('');

  const handleCostSave = async (serviceId) => {
    const val = parseFloat(editingCostValue);
    if (isNaN(val) || val < 0) {
      toast.error('Enter a valid cost');
      return;
    }
    const res = await updateService(serviceId, { monthlyCost: val });
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Cost updated');
      router.refresh();
    }
    setEditingCostId(null);
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    setSelectedProviders([]);

    try {
      const res = await fetch(`/api/projects/${projectId}/scan-services`, { method: 'POST' });
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
      } else {
        setScanResult(data);
        // Auto-select all new services
        setSelectedProviders(
          (data.new || []).map((s) => s.provider)
        );
        const newCount = data.new?.length || 0;
        toast.success(`Scan complete — ${data.detected?.length || 0} services found${newCount > 0 ? `, ${newCount} new` : ''}`);
      }
    } catch {
      toast.error('Failed to scan repos');
    }
    setScanning(false);
  };

  const toggleProvider = (provider) => {
    setSelectedProviders((prev) =>
      prev.includes(provider)
        ? prev.filter((p) => p !== provider)
        : [...prev, provider]
    );
  };

  const handleConfirm = async () => {
    if (selectedProviders.length === 0) {
      toast.error('Select at least one service');
      return;
    }
    setConfirming(true);
    const res = await confirmDetectedServices(projectId, selectedProviders);
    setConfirming(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success(`${res.created} service${res.created !== 1 ? 's' : ''} added`);
      setScanResult(null);
      setSelectedProviders([]);
      router.refresh();
    }
  };

  const handleAddManual = async () => {
    setAddSaving(true);
    const res = await addManualProjectService(projectId, addForm);
    setAddSaving(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Service added');
      setShowAddModal(false);
      setAddForm({ serviceName: '', provider: '', category: 'other', monthlyCost: '0' });
      router.refresh();
    }
  };

  const handleRemove = async (serviceId) => {
    setRemovingId(serviceId);
    const res = await removeProjectService(serviceId, projectId);
    setRemovingId(null);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Service removed');
      router.refresh();
    }
  };

  const newDetected = scanResult?.new || [];

  return (
    <>
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
        <h6 className="text-white fw-semibold mb-0 me-auto">Project Services</h6>
        <button
          className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          onClick={handleScan}
          disabled={scanning || !hasRepos}
          title={!hasRepos ? 'Link a GitHub repo first' : 'Scan linked repos for services'}
        >
          {scanning ? (
            <span className="spinner-border spinner-border-sm" />
          ) : (
            <Icon icon="mdi:magnify-scan" style={{ fontSize: '16px' }} />
          )}
          {scanning ? 'Scanning...' : 'Scan Repos'}
        </button>
        <button
          className="btn btn-primary btn-sm d-flex align-items-center gap-1"
          onClick={() => setShowAddModal(true)}
        >
          <Icon icon="mdi:plus" style={{ fontSize: '16px' }} />
          Add Service
        </button>
      </div>

      {/* Last Scan Banner */}
      {scanResult && (
        <div className="alert d-flex align-items-center gap-2 mb-4" style={{ background: 'rgba(3,255,0,0.08)', border: '1px solid rgba(3,255,0,0.2)', borderRadius: '8px' }}>
          <Icon icon="mdi:check-circle-outline" style={{ fontSize: '18px', color: '#03FF00' }} />
          <span className="text-white text-sm flex-grow-1">
            Scanned {scanResult.scannedFiles?.length || 0} files — found {scanResult.detected?.length || 0} services
            {newDetected.length > 0 ? `, ${newDetected.length} new` : ', all already tracked'}
          </span>
          <span className="text-secondary-light text-xs">{timeAgo(scanResult.scanTime)}</span>
        </div>
      )}

      {/* Detected Services Section */}
      {newDetected.length > 0 && (
        <div className="card mb-4">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h6 className="text-white fw-semibold mb-0">
              <Icon icon="mdi:radar" className="me-2" style={{ fontSize: '18px', color: '#03FF00' }} />
              Detected Services ({newDetected.length} new)
            </h6>
            <button
              className="btn btn-primary btn-sm d-flex align-items-center gap-1"
              onClick={handleConfirm}
              disabled={confirming || selectedProviders.length === 0}
            >
              {confirming ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <Icon icon="mdi:check-all" style={{ fontSize: '16px' }} />
              )}
              Add Selected ({selectedProviders.length})
            </button>
          </div>
          <div className="card-body">
            <div className="row g-3">
              {newDetected.map((svc) => {
                const conf = CONFIDENCE_BADGES[svc.confidence];
                const selected = selectedProviders.includes(svc.provider);
                const catObj = SERVICE_CATEGORIES.find((c) => c.value === svc.category);
                const pricing = DEFAULT_SERVICE_PRICING[svc.provider];

                return (
                  <div key={svc.provider} className="col-sm-6 col-lg-4">
                    <div
                      className="card h-100"
                      style={{
                        cursor: 'pointer',
                        border: selected ? '1px solid #03FF00' : '1px solid rgba(255,255,255,0.1)',
                        background: selected ? 'rgba(3,255,0,0.05)' : undefined,
                      }}
                      onClick={() => toggleProvider(svc.provider)}
                    >
                      <div className="card-body py-3 px-3">
                        <div className="d-flex align-items-start gap-2 mb-2">
                          <input
                            type="checkbox"
                            className="form-check-input mt-1"
                            checked={selected}
                            onChange={() => toggleProvider(svc.provider)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2">
                              <span className="text-white text-sm fw-semibold">{svc.provider}</span>
                              <span
                                className="badge fw-medium"
                                style={{ background: conf.bg, color: conf.color, fontSize: '10px' }}
                              >
                                {conf.label}
                              </span>
                            </div>
                            {catObj && (
                              <span className="text-secondary-light text-xs d-flex align-items-center gap-1 mt-1">
                                <Icon icon={catObj.icon} style={{ fontSize: '12px' }} />
                                {catObj.label}
                              </span>
                            )}
                            {pricing && (
                              <span className="text-xs mt-1 d-block" style={{ color: pricing.monthlyCost > 0 ? '#03FF00' : '#6c757d' }}>
                                {pricing.monthlyCost > 0 ? `$${pricing.monthlyCost}/mo (${pricing.plan} plan)` : `Usage-based (${pricing.plan})`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="d-flex flex-column gap-1 mt-2">
                          {svc.signals.map((sig, i) => (
                            <span key={i} className="text-secondary-light" style={{ fontSize: '11px' }}>
                              <Icon icon="mdi:chevron-right" style={{ fontSize: '12px' }} /> {sig}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tracked Services Table */}
      {services.length === 0 && !scanResult ? (
        <div className="card">
          <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
            <Icon icon="mdi:server-network" className="text-secondary-light mb-2" style={{ fontSize: '36px' }} />
            <p className="text-secondary-light text-sm mb-2">
              No services tracked yet. {hasRepos ? 'Scan repos to auto-detect, or add manually.' : 'Link a GitHub repo and scan to auto-detect, or add manually.'}
            </p>
            <div className="d-flex gap-2">
              {hasRepos && (
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={handleScan}
                  disabled={scanning}
                >
                  <Icon icon="mdi:magnify-scan" className="me-1" style={{ fontSize: '16px' }} />
                  Scan Repos
                </button>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddModal(true)}
              >
                <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
                Add Manually
              </button>
            </div>
          </div>
        </div>
      ) : services.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h6 className="text-white fw-semibold mb-0">Tracked Services ({services.length})</h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0">
                <thead>
                  <tr className="text-secondary-light text-xs">
                    <th>Provider</th>
                    <th>Service Name</th>
                    <th>Category</th>
                    <th>Monthly Cost</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th style={{ width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc) => {
                    const statusObj = SERVICE_STATUSES.find((s) => s.value === svc.status) || SERVICE_STATUSES[0];
                    const catObj = SERVICE_CATEGORIES.find((c) => c.value === svc.category);
                    const isAutoDetected = svc.notes?.includes('auto-detected') || svc.serviceName?.includes('auto-detected');

                    return (
                      <tr key={svc.id}>
                        <td>
                          <span className="text-white text-sm fw-medium">{svc.provider}</span>
                        </td>
                        <td>
                          <span className="text-secondary-light text-sm">{svc.serviceName}</span>
                        </td>
                        <td>
                          <span className="d-flex align-items-center gap-1 text-secondary-light text-sm">
                            {catObj && <Icon icon={catObj.icon} style={{ fontSize: '14px' }} />}
                            {catObj?.label || svc.category}
                          </span>
                        </td>
                        <td>
                          {editingCostId === svc.id ? (
                            <input
                              type="number"
                              className="form-control form-control-sm bg-base text-white"
                              style={{ width: '100px' }}
                              min="0"
                              step="0.01"
                              autoFocus
                              value={editingCostValue}
                              onChange={(e) => setEditingCostValue(e.target.value)}
                              onBlur={() => handleCostSave(svc.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCostSave(svc.id);
                                if (e.key === 'Escape') setEditingCostId(null);
                              }}
                            />
                          ) : (
                            <span
                              className="text-white text-sm"
                              style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.3)' }}
                              title="Click to edit"
                              onClick={() => {
                                setEditingCostId(svc.id);
                                setEditingCostValue(svc.monthlyCost || '0');
                              }}
                            >
                              {formatCurrency(svc.monthlyCost)}
                            </span>
                          )}
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
                          <span
                            className="badge fw-medium"
                            style={{
                              background: isAutoDetected ? 'rgba(3,255,0,0.1)' : 'rgba(108,117,125,0.15)',
                              color: isAutoDetected ? '#03FF00' : '#6c757d',
                              fontSize: '10px',
                            }}
                          >
                            {isAutoDetected ? 'auto-detected' : 'manual'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-outline-danger btn-sm p-1"
                            title="Remove service"
                            onClick={() => handleRemove(svc.id)}
                            disabled={removingId === svc.id}
                          >
                            {removingId === svc.id ? (
                              <span className="spinner-border spinner-border-sm" style={{ width: '14px', height: '14px' }} />
                            ) : (
                              <Icon icon="mdi:trash-can-outline" style={{ fontSize: '14px' }} />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddModal && (
        <div
          className="modal d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowAddModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-base">
              <div className="modal-header border-secondary-subtle">
                <h6 className="modal-title text-white fw-semibold">Add Service</h6>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => setShowAddModal(false)}
                />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">Provider</label>
                    <select
                      className="form-select bg-base text-white"
                      value={addForm.provider}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, provider: e.target.value }))}
                    >
                      <option value="">Select provider...</option>
                      {COST_PROVIDERS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">Service Name</label>
                    <input
                      type="text"
                      className="form-control bg-base text-white"
                      placeholder="e.g. Supabase Pro Plan"
                      value={addForm.serviceName}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, serviceName: e.target.value }))}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">Category</label>
                    <select
                      className="form-select bg-base text-white"
                      value={addForm.category}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, category: e.target.value }))}
                    >
                      {SERVICE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">Monthly Cost ($)</label>
                    <input
                      type="number"
                      className="form-control bg-base text-white"
                      min="0"
                      step="0.01"
                      value={addForm.monthlyCost}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, monthlyCost: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer border-secondary-subtle">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddManual}
                  disabled={addSaving || !addForm.serviceName || !addForm.provider}
                >
                  {addSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Adding...
                    </>
                  ) : (
                    'Add Service'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectServicesTab;
