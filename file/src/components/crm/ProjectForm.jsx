'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { createProject } from '@/lib/actions/projects';
import { DEFAULT_PROJECT_PHASES } from '@/lib/utils/constants';

const ProjectForm = ({ clients, defaultClientId, defaultLeadId }) => {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    clientId: defaultClientId || '',
    projectType: '',
    description: '',
    pricingType: 'fixed',
    totalValue: '',
    startDate: '',
    targetEndDate: '',
  });

  // Editable phase template
  const [phases, setPhases] = useState(
    DEFAULT_PROJECT_PHASES.map((p) => ({
      ...p,
      milestones: p.milestones.map((m) => ({ title: m })),
    }))
  );

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Phase operations
  const addPhase = () => {
    setPhases((prev) => [
      ...prev,
      {
        name: 'New Phase',
        sortOrder: prev.length + 1,
        milestones: [{ title: 'New milestone' }],
      },
    ]);
  };

  const removePhase = (idx) => {
    setPhases((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePhaseName = (idx, name) => {
    setPhases((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, name } : p))
    );
  };

  // Milestone operations
  const addMilestone = (phaseIdx) => {
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIdx
          ? { ...p, milestones: [...p.milestones, { title: '' }] }
          : p
      )
    );
  };

  const removeMilestone = (phaseIdx, msIdx) => {
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIdx
          ? { ...p, milestones: p.milestones.filter((_, j) => j !== msIdx) }
          : p
      )
    );
  };

  const updateMilestoneTitle = (phaseIdx, msIdx, title) => {
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIdx
          ? {
              ...p,
              milestones: p.milestones.map((m, j) =>
                j === msIdx ? { ...m, title } : m
              ),
            }
          : p
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    if (!form.clientId) {
      toast.error('Please select a client');
      return;
    }

    // Filter out empty milestones
    const cleanPhases = phases
      .filter((p) => p.name.trim())
      .map((p, i) => ({
        name: p.name.trim(),
        sortOrder: i + 1,
        milestones: p.milestones
          .filter((m) => m.title.trim())
          .map((m) => ({ title: m.title.trim() })),
      }));

    setSubmitting(true);

    const formData = {
      ...form,
      totalValue: form.totalValue ? parseFloat(form.totalValue) : 0,
    };

    if (defaultLeadId) {
      formData.leadId = defaultLeadId;
    }

    const res = await createProject(formData, cleanPhases);
    setSubmitting(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Project created');
      router.push(`/projects/${res.projectId}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="row g-4">
        {/* Left: Project Info */}
        <div className="col-xxl-7 col-xl-6">
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="text-white fw-semibold mb-0">Project Details</h6>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label text-secondary-light text-xs">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    className="form-control bg-base text-white"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">
                    Client *
                  </label>
                  <select
                    className="form-select bg-base text-white"
                    value={form.clientId}
                    onChange={(e) => updateField('clientId', e.target.value)}
                    required
                    disabled={submitting}
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}{c.company ? ` (${c.company})` : ''}
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
                    placeholder="e.g. Web App, AI Agent, Chatbot"
                    value={form.projectType}
                    onChange={(e) => updateField('projectType', e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label text-secondary-light text-xs">
                    Description
                  </label>
                  <textarea
                    className="form-control bg-base text-white"
                    rows={3}
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="col-sm-4">
                  <label className="form-label text-secondary-light text-xs">
                    Pricing Type
                  </label>
                  <select
                    className="form-select bg-base text-white"
                    value={form.pricingType}
                    onChange={(e) => updateField('pricingType', e.target.value)}
                    disabled={submitting}
                  >
                    <option value="fixed">Fixed</option>
                    <option value="phased">Phased</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
                <div className="col-sm-4">
                  <label className="form-label text-secondary-light text-xs">
                    Total Value ($)
                  </label>
                  <input
                    type="number"
                    className="form-control bg-base text-white"
                    min="0"
                    step="0.01"
                    value={form.totalValue}
                    onChange={(e) => updateField('totalValue', e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="col-sm-4" />
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="form-control bg-base text-white"
                    value={form.startDate}
                    onChange={(e) => updateField('startDate', e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label text-secondary-light text-xs">
                    Target End Date
                  </label>
                  <input
                    type="date"
                    className="form-control bg-base text-white"
                    value={form.targetEndDate}
                    onChange={(e) =>
                      updateField('targetEndDate', e.target.value)
                    }
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Phase Template */}
        <div className="col-xxl-5 col-xl-6">
          <div className="card mb-4">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h6 className="text-white fw-semibold mb-0">
                Phases &amp; Milestones
              </h6>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={addPhase}
                disabled={submitting}
              >
                <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '14px' }} />
                Add Phase
              </button>
            </div>
            <div className="card-body">
              {phases.map((phase, phaseIdx) => (
                <div key={phaseIdx} className="mb-3 pb-3 border-bottom border-secondary-subtle">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <input
                      type="text"
                      className="form-control form-control-sm bg-base text-white fw-semibold"
                      value={phase.name}
                      onChange={(e) =>
                        updatePhaseName(phaseIdx, e.target.value)
                      }
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => removePhase(phaseIdx)}
                      disabled={submitting}
                      title="Remove phase"
                    >
                      <Icon icon="mdi:delete-outline" style={{ fontSize: '14px' }} />
                    </button>
                  </div>

                  {phase.milestones.map((ms, msIdx) => (
                    <div
                      key={msIdx}
                      className="d-flex align-items-center gap-2 ms-3 mb-1"
                    >
                      <Icon
                        icon="mdi:circle-outline"
                        className="text-secondary-light"
                        style={{ fontSize: '10px', flexShrink: 0 }}
                      />
                      <input
                        type="text"
                        className="form-control form-control-sm bg-base text-white"
                        value={ms.title}
                        onChange={(e) =>
                          updateMilestoneTitle(phaseIdx, msIdx, e.target.value)
                        }
                        placeholder="Milestone title"
                        disabled={submitting}
                      />
                      <button
                        type="button"
                        className="btn btn-sm text-secondary-light p-0"
                        onClick={() => removeMilestone(phaseIdx, msIdx)}
                        disabled={submitting}
                        style={{ lineHeight: 1 }}
                        title="Remove milestone"
                      >
                        <Icon icon="mdi:close" style={{ fontSize: '14px' }} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn btn-sm text-secondary-light ms-3 mt-1 p-0"
                    onClick={() => addMilestone(phaseIdx)}
                    disabled={submitting}
                    style={{ fontSize: '12px' }}
                  >
                    <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '12px' }} />
                    Add milestone
                  </button>
                </div>
              ))}

              {phases.length === 0 && (
                <p className="text-secondary-light text-sm mb-0">
                  No phases. Click &quot;Add Phase&quot; to start.
                </p>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="d-flex gap-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" />
                  Creating...
                </>
              ) : (
                <>
                  <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
                  Create Project
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => router.push('/projects')}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default ProjectForm;
