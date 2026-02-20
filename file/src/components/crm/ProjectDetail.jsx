'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { updateProject, updateProjectStatus } from '@/lib/actions/projects';
import { formatDate, formatCurrency } from '@/lib/utils/formatters';
import { PROJECT_STATUSES, INVOICE_STATUSES } from '@/lib/utils/constants';
import MilestoneEditor from './MilestoneEditor';
import ReposDemosTab from './ReposDemosTab';
import QuestionReply from './QuestionReply';

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'mdi:information-outline' },
  { key: 'milestones', label: 'Milestones', icon: 'mdi:flag-outline' },
  { key: 'repos', label: 'Repos & Demos', icon: 'mdi:github' },
  { key: 'questions', label: 'Questions', icon: 'mdi:help-circle-outline' },
  { key: 'invoices', label: 'Invoices', icon: 'mdi:receipt-text-outline' },
];

const ProjectDetail = ({ project: initialProject, projectInvoices = [], projectQuestions = [] }) => {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [activeTab, setActiveTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  // Sync local state when server re-renders with new data
  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  // Editable overview fields
  const [editForm, setEditForm] = useState({
    name: project.name,
    projectType: project.projectType || '',
    description: project.description || '',
    pricingType: project.pricingType,
    totalValue: project.totalValue || '0',
    startDate: project.startDate || '',
    targetEndDate: project.targetEndDate || '',
  });

  // Sync edit form when project changes
  useEffect(() => {
    setEditForm({
      name: project.name,
      projectType: project.projectType || '',
      description: project.description || '',
      pricingType: project.pricingType,
      totalValue: project.totalValue || '0',
      startDate: project.startDate || '',
      targetEndDate: project.targetEndDate || '',
    });
  }, [project]);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateProject(project.id, {
      ...editForm,
      totalValue: parseFloat(editForm.totalValue) || 0,
    });
    setSaving(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Project updated');
      setProject((prev) => ({ ...prev, ...editForm }));
    }
  };

  const handleStatusChange = async (status) => {
    if (status === 'completed') {
      setShowCompleteConfirm(true);
      return;
    }

    setStatusChanging(true);
    const res = await updateProjectStatus(project.id, status);
    setStatusChanging(false);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Status updated');
      setProject((prev) => ({ ...prev, status }));
    }
  };

  const handleConfirmComplete = async () => {
    setShowCompleteConfirm(false);
    setStatusChanging(true);
    const res = await updateProjectStatus(project.id, 'completed');
    setStatusChanging(false);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Project completed');
      // Update all milestones to completed and progress to 100%
      setProject((prev) => ({
        ...prev,
        status: 'completed',
        progress: 100,
        completedMilestones: prev.totalMilestones,
        phases: prev.phases.map((phase) => ({
          ...phase,
          milestones: phase.milestones.map((ms) => ({ ...ms, status: 'completed' })),
        })),
      }));
    }
  };

  // Callback from MilestoneEditor when milestone status changes
  const handleProgressChange = (totalMs, completedMs) => {
    const progress = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;
    setProject((prev) => ({
      ...prev,
      progress,
      completedMilestones: completedMs,
      totalMilestones: totalMs,
    }));
  };

  const statusObj =
    PROJECT_STATUSES.find((s) => s.value === project.status) || PROJECT_STATUSES[0];

  return (
    <>
      {/* Back button */}
      <div className="d-flex align-items-center gap-2 mb-4">
        <button
          className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          onClick={() => router.push('/projects')}
        >
          <Icon icon="mdi:arrow-left" style={{ fontSize: '16px' }} />
          Projects
        </button>
      </div>

      {/* Header */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <h4 className="text-white fw-semibold mb-0">{project.name}</h4>
        <span
          className="badge fw-medium"
          style={{
            background: `${statusObj.color}20`,
            color: statusObj.color,
          }}
        >
          {statusObj.label}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="text-secondary-light text-xs mb-1">Client</div>
              <Link
                href={`/clients/${project.clientId}`}
                className="text-white text-sm fw-semibold text-decoration-none"
              >
                {project.clientName}
              </Link>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="text-secondary-light text-xs mb-1">Value</div>
              <div className="text-white text-lg fw-semibold">
                {formatCurrency(project.totalValue)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="text-secondary-light text-xs mb-1">Progress</div>
              <div className="text-white text-lg fw-semibold">
                {project.progress}%
              </div>
              <div
                className="progress mt-1"
                style={{ height: '4px', background: 'rgba(255,255,255,0.1)' }}
              >
                <div
                  className="progress-bar"
                  style={{
                    width: `${project.progress}%`,
                    background: project.progress === 100 ? '#198754' : '#03FF00',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body py-3 px-4">
              <div className="text-secondary-light text-xs mb-1">Milestones</div>
              <div className="text-white text-lg fw-semibold">
                {project.completedMilestones}/{project.totalMilestones}
              </div>
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
            </button>
          </li>
        ))}
      </ul>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="row g-4">
          <div className="col-xxl-8 col-xl-7">
            <div className="card mb-4">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h6 className="text-white fw-semibold mb-0">Project Info</h6>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">
                      Project Name
                    </label>
                    <input
                      type="text"
                      className="form-control bg-base text-white"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">
                      Status
                    </label>
                    <select
                      className="form-select bg-base text-white"
                      value={project.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={statusChanging}
                    >
                      {PROJECT_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">
                      Project Type
                    </label>
                    <input
                      type="text"
                      className="form-control bg-base text-white"
                      value={editForm.projectType}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          projectType: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="col-sm-3">
                    <label className="form-label text-secondary-light text-xs">
                      Pricing Type
                    </label>
                    <select
                      className="form-select bg-base text-white"
                      value={editForm.pricingType}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          pricingType: e.target.value,
                        }))
                      }
                    >
                      <option value="fixed">Fixed</option>
                      <option value="phased">Phased</option>
                      <option value="hourly">Hourly</option>
                    </select>
                  </div>
                  <div className="col-sm-3">
                    <label className="form-label text-secondary-light text-xs">
                      Total Value ($)
                    </label>
                    <input
                      type="number"
                      className="form-control bg-base text-white"
                      min="0"
                      step="0.01"
                      value={editForm.totalValue}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          totalValue: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label text-secondary-light text-xs">
                      Description
                    </label>
                    <textarea
                      className="form-control bg-base text-white"
                      rows={3}
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">
                      Start Date
                    </label>
                    <input
                      type="date"
                      className="form-control bg-base text-white"
                      value={editForm.startDate}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          startDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary-light text-xs">
                      Target End Date
                    </label>
                    <input
                      type="date"
                      className="form-control bg-base text-white"
                      value={editForm.targetEndDate}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          targetEndDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xxl-4 col-xl-5">
            {/* Progress */}
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Progress</h6>
              </div>
              <div className="card-body">
                <div className="text-center mb-3">
                  <div className="text-white display-6 fw-bold">
                    {project.progress}%
                  </div>
                  <p className="text-secondary-light text-xs mb-0">
                    {project.completedMilestones} of {project.totalMilestones}{' '}
                    milestones complete
                  </p>
                </div>
                <div
                  className="progress"
                  style={{ height: '8px', background: 'rgba(255,255,255,0.1)' }}
                >
                  <div
                    className="progress-bar"
                    style={{
                      width: `${project.progress}%`,
                      background: project.progress === 100 ? '#198754' : '#03FF00',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Linked Records */}
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Linked Records</h6>
              </div>
              <div className="card-body">
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex align-items-start gap-2">
                    <Icon icon="mdi:account-outline" className="text-secondary-light mt-1" style={{ fontSize: '18px' }} />
                    <div>
                      <label className="text-secondary-light text-xs d-block mb-1">
                        Client
                      </label>
                      <Link
                        href={`/clients/${project.clientId}`}
                        className="text-white text-sm text-decoration-none d-block"
                      >
                        {project.clientName}
                        {project.clientCompany
                          ? ` (${project.clientCompany})`
                          : ''}
                      </Link>
                      {project.clientEmail && (
                        <span className="text-secondary-light text-xs">{project.clientEmail}</span>
                      )}
                    </div>
                  </div>
                  {project.leadId && (
                    <div className="d-flex align-items-start gap-2">
                      <Icon icon="mdi:account-search-outline" className="text-secondary-light mt-1" style={{ fontSize: '18px' }} />
                      <div>
                        <label className="text-secondary-light text-xs d-block mb-1">
                          Lead
                        </label>
                        <Link
                          href={`/leads/${project.leadId}`}
                          className="text-white text-sm text-decoration-none d-block"
                        >
                          {project.leadName || 'View Lead'}
                        </Link>
                        {project.leadStage && (
                          <span className="text-secondary-light text-xs">
                            Stage: {project.leadStage.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {project.proposalId && (
                    <div className="d-flex align-items-start gap-2">
                      <Icon icon="mdi:file-document-outline" className="text-secondary-light mt-1" style={{ fontSize: '18px' }} />
                      <div>
                        <label className="text-secondary-light text-xs d-block mb-1">
                          Proposal
                        </label>
                        <Link
                          href={`/proposals/${project.proposalId}`}
                          className="text-white text-sm text-decoration-none d-block"
                        >
                          {project.proposalTitle || 'View Proposal'}
                        </Link>
                      </div>
                    </div>
                  )}
                  {!project.leadId && !project.proposalId && (
                    <p className="text-secondary-light text-xs mb-0">
                      No lead or proposal linked to this project.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="text-white fw-semibold mb-0">Details</h6>
              </div>
              <div className="card-body">
                <div className="d-flex flex-column gap-3">
                  <div>
                    <label className="text-secondary-light text-xs d-block mb-1">
                      Created
                    </label>
                    <span className="text-white text-sm">
                      {formatDate(project.createdAt)}
                    </span>
                  </div>
                  {project.createdByName && (
                    <div>
                      <label className="text-secondary-light text-xs d-block mb-1">
                        Created By
                      </label>
                      <span className="text-white text-sm">
                        {project.createdByName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Milestones Tab */}
      {activeTab === 'milestones' && (
        <MilestoneEditor
          projectId={project.id}
          phases={project.phases}
          onProgressChange={handleProgressChange}
        />
      )}

      {/* Repos & Demos Tab */}
      {activeTab === 'repos' && (
        <ReposDemosTab
          projectId={project.id}
          repos={project.repos}
          demos={project.demos}
          phases={project.phases}
        />
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <QuestionReply
          projectId={project.id}
          projectName={project.name}
          questions={projectQuestions}
        />
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <>
          {projectInvoices.length === 0 ? (
            <div className="card">
              <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
                <Icon
                  icon="mdi:receipt-text-outline"
                  className="text-secondary-light mb-2"
                  style={{ fontSize: '36px' }}
                />
                <p className="text-secondary-light text-sm mb-2">
                  No invoices yet for this project.
                </p>
                <Link
                  href={`/invoices/new?client_id=${project.clientId}&project_id=${project.id}`}
                  className="btn btn-primary btn-sm"
                >
                  <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
                  Create Invoice
                </Link>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-dark table-hover mb-0">
                    <thead>
                      <tr className="text-secondary-light text-xs">
                        <th>Title</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Due Date</th>
                        <th>Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectInvoices.map((inv) => {
                        const invStatusObj = INVOICE_STATUSES.find((s) => s.value === inv.status) || INVOICE_STATUSES[0];
                        return (
                          <tr
                            key={inv.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => router.push(`/invoices/${inv.id}`)}
                          >
                            <td>
                              <span className="text-white text-sm fw-medium">{inv.title}</span>
                            </td>
                            <td>
                              <span className="text-white text-sm fw-medium">
                                {formatCurrency(inv.amount)}
                              </span>
                            </td>
                            <td>
                              <span
                                className="badge fw-medium"
                                style={{ background: `${invStatusObj.color}22`, color: invStatusObj.color }}
                              >
                                {invStatusObj.label}
                              </span>
                            </td>
                            <td>
                              <span className="text-secondary-light text-sm">
                                {inv.dueDate ? formatDate(inv.dueDate) : '—'}
                              </span>
                            </td>
                            <td>
                              <span className="text-secondary-light text-sm">
                                {inv.paidAt ? formatDate(inv.paidAt) : '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card-footer">
                <Link
                  href={`/invoices/new?client_id=${project.clientId}&project_id=${project.id}`}
                  className="btn btn-outline-secondary btn-sm"
                >
                  <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
                  New Invoice
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* Complete Project Confirmation Modal */}
      {showCompleteConfirm && (
        <div
          className="modal d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowCompleteConfirm(false)}
        >
          <div className="modal-dialog modal-sm modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-base">
              <div className="modal-header border-secondary-subtle">
                <h6 className="modal-title text-white fw-semibold">Complete Project</h6>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => setShowCompleteConfirm(false)}
                />
              </div>
              <div className="modal-body">
                <p className="text-white text-sm mb-0">
                  Mark project as completed? This will complete all remaining milestones.
                </p>
              </div>
              <div className="modal-footer border-secondary-subtle">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowCompleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleConfirmComplete}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectDetail;
