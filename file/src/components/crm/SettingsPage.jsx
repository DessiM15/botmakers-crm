'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import SettingsIntegrations from './SettingsIntegrations';
import { inviteTeamMember, toggleTeamMemberActive, saveSetting } from '@/lib/actions/settings';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const TABS = [
  { key: 'integrations', label: 'Integrations', icon: 'mdi:puzzle-outline' },
  { key: 'team', label: 'Team', icon: 'mdi:account-group-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'mdi:bell-outline' },
  { key: 'defaults', label: 'Defaults', icon: 'mdi:cog-outline' },
];

const SettingsPage = ({
  githubConfigured,
  squareConfigured,
  squareEnvironment,
  siteUrl,
  teamMembers,
  staleDays: initialStaleDays,
  defaultProposalTerms: initialProposalTerms,
  defaultProjectPhases: initialProjectPhases,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('integrations');

  return (
    <>
      <h4 className="text-white fw-semibold mb-4">Settings</h4>

      {/* Tabs */}
      <ul className="nav nav-tabs border-secondary-subtle mb-4">
        {TABS.map((tab) => (
          <li key={tab.key} className="nav-item">
            <button
              className={`nav-link ${activeTab === tab.key ? 'active' : 'text-secondary-light'}`}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #03FF00' : '2px solid transparent',
                color: activeTab === tab.key ? '#03FF00' : undefined,
                padding: '8px 16px',
                cursor: 'pointer',
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon icon={tab.icon} className="me-1" style={{ fontSize: '16px' }} />
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === 'integrations' && (
        <SettingsIntegrations
          githubConfigured={githubConfigured}
          squareConfigured={squareConfigured}
          squareEnvironment={squareEnvironment}
          siteUrl={siteUrl}
        />
      )}

      {activeTab === 'team' && (
        <TeamTab members={teamMembers} onUpdate={() => router.refresh()} />
      )}

      {activeTab === 'notifications' && (
        <NotificationsTab initialStaleDays={initialStaleDays} />
      )}

      {activeTab === 'defaults' && (
        <DefaultsTab
          initialProposalTerms={initialProposalTerms}
          initialProjectPhases={initialProjectPhases}
        />
      )}
    </>
  );
};

function TeamTab({ members, onUpdate }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [toggling, setToggling] = useState(null);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    const result = await inviteTeamMember(inviteEmail, inviteName, inviteRole);
    setInviting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Team member invited.');
      setShowInvite(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('member');
      onUpdate();
    }
  };

  const handleToggle = async (userId, currentActive) => {
    setToggling(userId);
    const result = await toggleTeamMemberActive(userId, !currentActive);
    setToggling(null);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(currentActive ? 'Team member deactivated.' : 'Team member activated.');
      onUpdate();
    }
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="text-white fw-semibold mb-0">Team Members</h6>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowInvite(!showInvite)}
        >
          <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '16px' }} />
          Invite Member
        </button>
      </div>

      {showInvite && (
        <div className="card mb-3">
          <div className="card-body">
            <form onSubmit={handleInvite}>
              <div className="row g-3">
                <div className="col-sm-4">
                  <label className="form-label text-secondary-light text-xs">Full Name</label>
                  <input
                    type="text"
                    className="form-control bg-base text-white"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                  />
                </div>
                <div className="col-sm-4">
                  <label className="form-label text-secondary-light text-xs">Email</label>
                  <input
                    type="email"
                    className="form-control bg-base text-white"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="col-sm-2">
                  <label className="form-label text-secondary-light text-xs">Role</label>
                  <select
                    className="form-select bg-base text-white"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="col-sm-2 d-flex align-items-end">
                  <button className="btn btn-primary btn-sm w-100" disabled={inviting}>
                    {inviting ? <span className="spinner-border spinner-border-sm" /> : 'Invite'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-dark table-hover mb-0">
              <thead>
                <tr className="text-secondary-light text-xs">
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="text-white text-sm fw-medium">{m.fullName}</td>
                    <td className="text-secondary-light text-sm">{m.email}</td>
                    <td>
                      <span
                        className="badge fw-medium"
                        style={{
                          background: m.role === 'admin' ? '#03FF0022' : '#6c757d22',
                          color: m.role === 'admin' ? '#03FF00' : '#6c757d',
                        }}
                      >
                        {m.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge fw-medium"
                        style={{
                          background: m.isActive ? '#19875422' : '#dc354522',
                          color: m.isActive ? '#198754' : '#dc3545',
                        }}
                      >
                        {m.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-secondary-light text-sm">
                      {new Date(m.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="text-end">
                      <button
                        className={`btn btn-sm ${m.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                        onClick={() => handleToggle(m.id, m.isActive)}
                        disabled={toggling === m.id}
                        style={{ fontSize: '11px' }}
                      >
                        {toggling === m.id ? (
                          <span className="spinner-border spinner-border-sm" />
                        ) : m.isActive ? (
                          'Deactivate'
                        ) : (
                          'Activate'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab({ initialStaleDays }) {
  const [staleDays, setStaleDays] = useState(initialStaleDays);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const result = await saveSetting('stale_lead_days', staleDays);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Settings saved.');
    }
  };

  return (
    <div>
      <div className="card mb-4">
        <div className="card-header">
          <h6 className="text-white fw-semibold mb-0">Stale Lead Detection</h6>
        </div>
        <div className="card-body">
          <p className="text-secondary-light text-sm mb-3">
            Leads that haven't been contacted within this threshold will trigger a daily notification to the team.
          </p>
          <div className="d-flex align-items-center gap-3">
            <div style={{ width: 200 }}>
              <label className="form-label text-secondary-light text-xs">
                Days before lead is &quot;stale&quot;
              </label>
              <input
                type="number"
                className="form-control bg-base text-white"
                value={staleDays}
                onChange={(e) => setStaleDays(Number(e.target.value) || 7)}
                min={1}
                max={90}
              />
            </div>
            <div className="d-flex align-items-end" style={{ paddingBottom: 0 }}>
              <button
                className="btn btn-primary btn-sm mt-auto"
                onClick={handleSave}
                disabled={saving}
                style={{ marginTop: '22px' }}
              >
                {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h6 className="text-white fw-semibold mb-0">Notification Types</h6>
        </div>
        <div className="card-body">
          <p className="text-secondary-light text-sm mb-3">
            All notification types are currently active. Email notifications are sent to all team members.
          </p>
          <div className="d-flex flex-column gap-2">
            {[
              { type: 'New Lead', desc: 'When a new lead is submitted', icon: 'mdi:account-plus-outline' },
              { type: 'Lead Stage Change', desc: 'When a lead moves to a new pipeline stage', icon: 'mdi:swap-horizontal' },
              { type: 'Proposal Accepted', desc: 'When a client accepts a proposal', icon: 'mdi:check-circle-outline' },
              { type: 'Payment Received', desc: 'When a payment is received via Square', icon: 'mdi:cash-check' },
              { type: 'Client Question', desc: 'When a client submits a question in the portal', icon: 'mdi:help-circle-outline' },
              { type: 'Milestone Overdue', desc: 'Daily alert for overdue milestones', icon: 'mdi:alert-circle-outline' },
              { type: 'Stale Lead', desc: 'Daily alert for leads needing follow-up', icon: 'mdi:clock-alert-outline' },
            ].map((n) => (
              <div key={n.type} className="d-flex align-items-center gap-3 p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Icon icon={n.icon} className="text-secondary-light" style={{ fontSize: '20px' }} />
                <div className="flex-grow-1">
                  <span className="text-white text-sm fw-medium">{n.type}</span>
                  <p className="text-secondary-light text-xs mb-0">{n.desc}</p>
                </div>
                <span className="badge bg-success bg-opacity-25 text-success" style={{ fontSize: '11px' }}>
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultsTab({ initialProposalTerms, initialProjectPhases }) {
  const [proposalTerms, setProposalTerms] = useState(initialProposalTerms || '');
  const [savingTerms, setSavingTerms] = useState(false);
  const [phases, setPhases] = useState(initialProjectPhases || [
    { name: 'Discovery', milestones: ['Initial consultation', 'Requirements documented', 'Project plan approved'] },
    { name: 'MVP Build', milestones: ['Dev environment setup', 'Core features implemented', 'Internal testing passed'] },
    { name: 'Revision', milestones: ['Client feedback collected', 'Revisions implemented', 'Final testing passed'] },
    { name: 'Launch', milestones: ['Deployment completed', 'Client training done', 'Project handoff complete'] },
  ]);
  const [savingPhases, setSavingPhases] = useState(false);

  const handleSaveTerms = async () => {
    setSavingTerms(true);
    const result = await saveSetting('default_proposal_terms', proposalTerms);
    setSavingTerms(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Default proposal terms saved.');
    }
  };

  const handleSavePhases = async () => {
    setSavingPhases(true);
    const result = await saveSetting('default_project_phases', phases);
    setSavingPhases(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Default project phases saved.');
    }
  };

  const updatePhaseName = (idx, name) => {
    setPhases((prev) => prev.map((p, i) => i === idx ? { ...p, name } : p));
  };

  const addPhase = () => {
    setPhases((prev) => [...prev, { name: '', milestones: [''] }]);
  };

  const removePhase = (idx) => {
    setPhases((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateMilestone = (phaseIdx, msIdx, value) => {
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIdx
          ? { ...p, milestones: p.milestones.map((m, j) => (j === msIdx ? value : m)) }
          : p
      )
    );
  };

  const addMilestone = (phaseIdx) => {
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIdx ? { ...p, milestones: [...p.milestones, ''] } : p
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

  return (
    <div>
      {/* Default Proposal Terms */}
      <div className="card mb-4">
        <div className="card-header">
          <h6 className="text-white fw-semibold mb-0">Default Proposal Terms</h6>
        </div>
        <div className="card-body">
          <p className="text-secondary-light text-sm mb-3">
            These terms will be pre-filled when creating a new proposal.
          </p>
          <div className="mb-3" style={{ minHeight: 200 }}>
            <ReactQuill
              theme="snow"
              value={proposalTerms}
              onChange={setProposalTerms}
              style={{ background: 'rgba(255,255,255,0.03)', color: '#fff', borderRadius: '8px' }}
            />
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSaveTerms}
            disabled={savingTerms}
          >
            {savingTerms ? <span className="spinner-border spinner-border-sm me-1" /> : null}
            Save Terms
          </button>
        </div>
      </div>

      {/* Default Project Phase Template */}
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h6 className="text-white fw-semibold mb-0">Default Project Phases</h6>
          <button className="btn btn-outline-success btn-sm" onClick={addPhase}>
            <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '14px' }} />
            Add Phase
          </button>
        </div>
        <div className="card-body">
          <p className="text-secondary-light text-sm mb-3">
            This template will be used when creating new projects.
          </p>
          <div className="d-flex flex-column gap-3">
            {phases.map((phase, pIdx) => (
              <div
                key={pIdx}
                className="p-3 rounded"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="text-secondary-light text-xs fw-medium" style={{ width: 28 }}>
                    #{pIdx + 1}
                  </span>
                  <input
                    type="text"
                    className="form-control form-control-sm bg-base text-white"
                    value={phase.name}
                    onChange={(e) => updatePhaseName(pIdx, e.target.value)}
                    placeholder="Phase name..."
                  />
                  {phases.length > 1 && (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => removePhase(pIdx)}
                      style={{ fontSize: '11px' }}
                    >
                      <Icon icon="mdi:delete-outline" style={{ fontSize: '14px' }} />
                    </button>
                  )}
                </div>
                <div className="ps-4">
                  {phase.milestones.map((ms, mIdx) => (
                    <div key={mIdx} className="d-flex align-items-center gap-2 mb-1">
                      <Icon icon="mdi:circle-small" className="text-secondary-light flex-shrink-0" style={{ fontSize: '16px' }} />
                      <input
                        type="text"
                        className="form-control form-control-sm bg-base text-white"
                        value={ms}
                        onChange={(e) => updateMilestone(pIdx, mIdx, e.target.value)}
                        placeholder="Milestone name..."
                        style={{ fontSize: '13px' }}
                      />
                      {phase.milestones.length > 1 && (
                        <button
                          className="btn btn-sm p-0 text-secondary-light"
                          onClick={() => removeMilestone(pIdx, mIdx)}
                          style={{ fontSize: '11px', lineHeight: 1 }}
                        >
                          <Icon icon="mdi:close" style={{ fontSize: '14px' }} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    className="btn btn-sm text-secondary-light mt-1"
                    onClick={() => addMilestone(pIdx)}
                    style={{ fontSize: '12px', padding: '2px 8px' }}
                  >
                    <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '12px' }} />
                    Add milestone
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary btn-sm mt-3"
            onClick={handleSavePhases}
            disabled={savingPhases}
          >
            {savingPhases ? <span className="spinner-border spinner-border-sm me-1" /> : null}
            Save Phases
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
