'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import {
  createPhase,
  deletePhase,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from '@/lib/actions/projects';
import { formatDate, formatCurrency } from '@/lib/utils/formatters';

const MILESTONE_STATUSES = [
  { value: 'pending', label: 'Pending', color: '#6c757d', icon: 'mdi:circle-outline' },
  { value: 'in_progress', label: 'In Progress', color: '#0d6efd', icon: 'mdi:progress-clock' },
  { value: 'completed', label: 'Completed', color: '#198754', icon: 'mdi:check-circle' },
  { value: 'overdue', label: 'Overdue', color: '#dc3545', icon: 'mdi:alert-circle' },
];

const MilestoneEditor = ({ projectId, phases: initialPhases }) => {
  const router = useRouter();
  const [phases, setPhases] = useState(initialPhases);
  const [expandedPhases, setExpandedPhases] = useState(
    initialPhases.reduce((acc, p) => ({ ...acc, [p.id]: true }), {})
  );
  const [, startTransition] = useTransition();

  // Add milestone modal
  const [addMsModal, setAddMsModal] = useState(null); // { phaseId }
  const [newMsTitle, setNewMsTitle] = useState('');
  const [addingMs, setAddingMs] = useState(false);

  // Add phase
  const [addingPhase, setAddingPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState(null);

  const togglePhase = (phaseId) => {
    setExpandedPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  // Handle milestone status change
  const handleStatusChange = async (milestone, newStatus) => {
    if (newStatus === 'completed' && milestone.status !== 'completed') {
      let msg = 'Mark this milestone as complete? The client will be notified.';
      if (milestone.triggersInvoice && milestone.invoiceAmount) {
        msg += `\n\nThis will also generate a ${formatCurrency(milestone.invoiceAmount)} invoice.`;
      }

      setConfirmDialog({
        message: msg,
        onConfirm: async () => {
          setConfirmDialog(null);
          await doUpdateMilestone(milestone.id, { status: 'completed' });
        },
      });
      return;
    }

    await doUpdateMilestone(milestone.id, { status: newStatus });
  };

  const doUpdateMilestone = async (milestoneId, data) => {
    const res = await updateMilestone(milestoneId, data);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Milestone updated');
      startTransition(() => router.refresh());
    }
  };

  const handleDueDateChange = async (milestoneId, dueDate) => {
    await doUpdateMilestone(milestoneId, { dueDate: dueDate || null });
  };

  const handleTriggersInvoiceChange = async (milestoneId, triggersInvoice) => {
    await doUpdateMilestone(milestoneId, { triggersInvoice });
  };

  const handleInvoiceAmountChange = async (milestoneId, invoiceAmount) => {
    await doUpdateMilestone(milestoneId, {
      invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : null,
    });
  };

  // Add milestone
  const handleAddMilestone = async () => {
    if (!newMsTitle.trim()) {
      toast.error('Milestone title is required');
      return;
    }
    setAddingMs(true);
    const res = await createMilestone(addMsModal.phaseId, projectId, {
      title: newMsTitle.trim(),
    });
    setAddingMs(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Milestone added');
      setAddMsModal(null);
      setNewMsTitle('');
      startTransition(() => router.refresh());
    }
  };

  // Delete milestone
  const handleDeleteMilestone = async (milestoneId) => {
    setConfirmDialog({
      message: 'Delete this milestone?',
      onConfirm: async () => {
        setConfirmDialog(null);
        const res = await deleteMilestone(milestoneId, projectId);
        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success('Milestone deleted');
          startTransition(() => router.refresh());
        }
      },
    });
  };

  // Add phase
  const handleAddPhase = async () => {
    if (!newPhaseName.trim()) {
      toast.error('Phase name is required');
      return;
    }
    setAddingPhase(true);
    const res = await createPhase(projectId, newPhaseName.trim());
    setAddingPhase(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Phase added');
      setNewPhaseName('');
      startTransition(() => router.refresh());
    }
  };

  // Delete phase
  const handleDeletePhase = async (phaseId) => {
    setConfirmDialog({
      message: 'Delete this phase and all its milestones?',
      onConfirm: async () => {
        setConfirmDialog(null);
        const res = await deletePhase(phaseId, projectId);
        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success('Phase deleted');
          startTransition(() => router.refresh());
        }
      },
    });
  };

  return (
    <>
      {/* Phases accordion */}
      <div className="accordion" id="phasesAccordion">
        {phases.map((phase, idx) => {
          const phaseCompleted = phase.milestones.filter(
            (m) => m.status === 'completed'
          ).length;
          const phaseTotal = phase.milestones.length;
          const phaseProgress =
            phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;
          const isExpanded = expandedPhases[phase.id];

          return (
            <div key={phase.id} className="card mb-2">
              <div
                className="card-header d-flex align-items-center justify-content-between py-2 px-3"
                style={{ cursor: 'pointer' }}
                onClick={() => togglePhase(phase.id)}
              >
                <div className="d-flex align-items-center gap-2">
                  <Icon
                    icon={isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'}
                    className="text-secondary-light"
                    style={{ fontSize: '18px' }}
                  />
                  <h6 className="text-white fw-semibold mb-0 text-sm">
                    {phase.name}
                  </h6>
                  <span className="text-secondary-light text-xs">
                    ({phaseCompleted}/{phaseTotal})
                  </span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div
                    className="progress"
                    style={{ width: '80px', height: '4px', background: 'rgba(255,255,255,0.1)' }}
                  >
                    <div
                      className="progress-bar"
                      style={{
                        width: `${phaseProgress}%`,
                        background: phaseProgress === 100 ? '#198754' : '#03FF00',
                      }}
                    />
                  </div>
                  <button
                    className="btn btn-sm text-secondary-light p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePhase(phase.id);
                    }}
                    title="Delete phase"
                  >
                    <Icon icon="mdi:delete-outline" style={{ fontSize: '16px' }} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="card-body p-0">
                  <table className="table table-sm mb-0" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th className="text-secondary-light text-xs fw-normal px-3" style={{ width: '35%' }}>
                          Milestone
                        </th>
                        <th className="text-secondary-light text-xs fw-normal" style={{ width: '20%' }}>
                          Status
                        </th>
                        <th className="text-secondary-light text-xs fw-normal" style={{ width: '18%' }}>
                          Due Date
                        </th>
                        <th className="text-secondary-light text-xs fw-normal" style={{ width: '15%' }}>
                          Invoice
                        </th>
                        <th className="text-secondary-light text-xs fw-normal text-end" style={{ width: '12%' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {phase.milestones.map((ms) => {
                        const statusObj =
                          MILESTONE_STATUSES.find((s) => s.value === ms.status) ||
                          MILESTONE_STATUSES[0];

                        return (
                          <tr key={ms.id}>
                            <td className="px-3 align-middle">
                              <div className="d-flex align-items-center gap-2">
                                <Icon
                                  icon={statusObj.icon}
                                  style={{ fontSize: '16px', color: statusObj.color, flexShrink: 0 }}
                                />
                                <span
                                  className={`text-sm ${
                                    ms.status === 'completed'
                                      ? 'text-secondary-light text-decoration-line-through'
                                      : 'text-white'
                                  }`}
                                >
                                  {ms.title}
                                </span>
                              </div>
                            </td>
                            <td className="align-middle">
                              <select
                                className="form-select form-select-sm bg-base text-white border-secondary-subtle"
                                value={ms.status}
                                onChange={(e) => handleStatusChange(ms, e.target.value)}
                                style={{ fontSize: '12px' }}
                              >
                                {MILESTONE_STATUSES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="align-middle">
                              <input
                                type="date"
                                className="form-control form-control-sm bg-base text-white border-secondary-subtle"
                                value={ms.dueDate || ''}
                                onChange={(e) =>
                                  handleDueDateChange(ms.id, e.target.value)
                                }
                                style={{ fontSize: '12px' }}
                              />
                            </td>
                            <td className="align-middle">
                              <div className="d-flex align-items-center gap-1">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={ms.triggersInvoice}
                                  onChange={(e) =>
                                    handleTriggersInvoiceChange(ms.id, e.target.checked)
                                  }
                                  title="Triggers invoice"
                                  style={{ marginTop: 0 }}
                                />
                                {ms.triggersInvoice && (
                                  <input
                                    type="number"
                                    className="form-control form-control-sm bg-base text-white border-secondary-subtle"
                                    placeholder="$"
                                    defaultValue={ms.invoiceAmount || ''}
                                    onBlur={(e) =>
                                      handleInvoiceAmountChange(ms.id, e.target.value)
                                    }
                                    style={{ fontSize: '12px', width: '80px' }}
                                  />
                                )}
                              </div>
                            </td>
                            <td className="align-middle text-end">
                              <button
                                className="btn btn-sm text-secondary-light p-0"
                                onClick={() => handleDeleteMilestone(ms.id)}
                                title="Delete"
                              >
                                <Icon icon="mdi:delete-outline" style={{ fontSize: '14px' }} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="px-3 py-2">
                    <button
                      className="btn btn-sm text-secondary-light p-0"
                      onClick={() => {
                        setAddMsModal({ phaseId: phase.id });
                        setNewMsTitle('');
                      }}
                      style={{ fontSize: '12px' }}
                    >
                      <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '14px' }} />
                      Add milestone
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {phases.length === 0 && (
        <div className="card">
          <div className="card-body text-center py-4">
            <p className="text-secondary-light text-sm mb-0">
              No phases yet. Add a phase to get started.
            </p>
          </div>
        </div>
      )}

      {/* Add Phase */}
      <div className="d-flex align-items-center gap-2 mt-3">
        <input
          type="text"
          className="form-control form-control-sm bg-base text-white border-secondary-subtle"
          placeholder="New phase name"
          value={newPhaseName}
          onChange={(e) => setNewPhaseName(e.target.value)}
          style={{ maxWidth: '250px' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddPhase();
            }
          }}
        />
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={handleAddPhase}
          disabled={addingPhase}
        >
          {addingPhase ? (
            <span className="spinner-border spinner-border-sm" />
          ) : (
            <>
              <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '14px' }} />
              Add Phase
            </>
          )}
        </button>
      </div>

      {/* Add Milestone Modal */}
      {addMsModal && (
        <div
          className="modal d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setAddMsModal(null)}
        >
          <div className="modal-dialog modal-sm modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-base">
              <div className="modal-header border-secondary-subtle">
                <h6 className="modal-title text-white fw-semibold">
                  Add Milestone
                </h6>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => setAddMsModal(null)}
                />
              </div>
              <div className="modal-body">
                <label className="form-label text-secondary-light text-xs">
                  Title
                </label>
                <input
                  type="text"
                  className="form-control bg-base text-white"
                  value={newMsTitle}
                  onChange={(e) => setNewMsTitle(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMilestone();
                    }
                  }}
                />
              </div>
              <div className="modal-footer border-secondary-subtle">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setAddMsModal(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddMilestone}
                  disabled={addingMs}
                >
                  {addingMs ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    'Add'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div
          className="modal d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setConfirmDialog(null)}
        >
          <div className="modal-dialog modal-sm modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-base">
              <div className="modal-header border-secondary-subtle">
                <h6 className="modal-title text-white fw-semibold">Confirm</h6>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => setConfirmDialog(null)}
                />
              </div>
              <div className="modal-body">
                <p className="text-white text-sm mb-0" style={{ whiteSpace: 'pre-line' }}>
                  {confirmDialog.message}
                </p>
              </div>
              <div className="modal-footer border-secondary-subtle">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setConfirmDialog(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={confirmDialog.onConfirm}
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

export default MilestoneEditor;
