'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import SettingsIntegrations from './SettingsIntegrations';
import Avatar from './Avatar';
import { inviteTeamMember, toggleTeamMemberActive, saveSetting, saveCalendarColors, saveNotificationPreferences, removeAvatar } from '@/lib/actions/settings';
import { NOTIFICATION_CATEGORIES, typeLabel } from '@/lib/utils/notification-helpers';
import { DEFAULT_CALENDAR_COLORS, CALENDAR_PRESET_COLORS } from '@/lib/utils/constants';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const TABS = [
  { key: 'profile', label: 'Profile', icon: 'mdi:account-circle-outline' },
  { key: 'integrations', label: 'Integrations', icon: 'mdi:puzzle-outline' },
  { key: 'team', label: 'Team', icon: 'mdi:account-group-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'mdi:bell-outline' },
  { key: 'calendar', label: 'Calendar', icon: 'mdi:calendar-outline' },
  { key: 'defaults', label: 'Defaults', icon: 'mdi:cog-outline' },
  { key: 'demo', label: 'Demo Data', icon: 'mdi:play-circle-outline', adminOnly: true },
];

const SettingsPage = ({
  currentUser,
  githubConfigured,
  squareConfigured,
  squareEnvironment,
  calConfigured,
  googleCalendarConfigured,
  googleCalendarConnected,
  googleCalendarEmail,
  siteUrl,
  teamMembers,
  staleDays: initialStaleDays,
  defaultProposalTerms: initialProposalTerms,
  defaultProjectPhases: initialProjectPhases,
  calendarColors: initialCalendarColors,
  trackingKeyConfigured,
  trackingKeyMasked,
  vercelBillingConfigured,
  anthropicBillingConfigured,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <>
      <h4 className="text-white fw-semibold mb-4">Settings</h4>

      {/* Tabs */}
      <ul className="nav nav-tabs border-secondary-subtle mb-4">
        {TABS.filter(tab => !tab.adminOnly || currentUser?.role === 'admin').map((tab) => (
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

      {activeTab === 'profile' && (
        <ProfileTab currentUser={currentUser} onUpdate={() => router.refresh()} />
      )}

      {activeTab === 'integrations' && (
        <SettingsIntegrations
          githubConfigured={githubConfigured}
          squareConfigured={squareConfigured}
          squareEnvironment={squareEnvironment}
          calConfigured={calConfigured}
          googleCalendarConfigured={googleCalendarConfigured}
          googleCalendarConnected={googleCalendarConnected}
          googleCalendarEmail={googleCalendarEmail}
          siteUrl={siteUrl}
          trackingKeyConfigured={trackingKeyConfigured}
          trackingKeyMasked={trackingKeyMasked}
          vercelBillingConfigured={vercelBillingConfigured}
          anthropicBillingConfigured={anthropicBillingConfigured}
        />
      )}

      {activeTab === 'team' && (
        <TeamTab members={teamMembers} onUpdate={() => router.refresh()} />
      )}

      {activeTab === 'notifications' && (
        <NotificationsTab initialStaleDays={initialStaleDays} />
      )}

      {activeTab === 'calendar' && (
        <CalendarTab initialColors={initialCalendarColors} />
      )}

      {activeTab === 'defaults' && (
        <DefaultsTab
          initialProposalTerms={initialProposalTerms}
          initialProjectPhases={initialProjectPhases}
        />
      )}

      {activeTab === 'demo' && currentUser?.role === 'admin' && (
        <DemoDataTab />
      )}
    </>
  );
};

function ProfileTab({ currentUser, onUpdate }) {
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Invalid file type. Use JPG, PNG, or WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 2MB.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/avatar/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Upload failed.');
      } else {
        toast.success('Profile photo updated.');
        setAvatarUrl(data.avatarUrl);
        onUpdate();
      }
    } catch {
      toast.error('Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    const result = await removeAvatar();
    setRemoving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Profile photo removed.');
      setAvatarUrl(null);
      onUpdate();
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h6 className="text-white fw-semibold mb-0">Your Profile</h6>
        </div>
        <div className="card-body">
          <div className="d-flex align-items-center gap-4">
            {/* Avatar with camera overlay */}
            <div className="position-relative" style={{ width: 80, height: 80 }}>
              <Avatar src={avatarUrl} name={currentUser?.fullName} size={80} />
              <label
                className="position-absolute d-flex align-items-center justify-content-center rounded-circle"
                style={{
                  bottom: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  background: '#03FF00',
                  cursor: uploading ? 'wait' : 'pointer',
                  border: '2px solid #1a1d21',
                }}
              >
                {uploading ? (
                  <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12, color: '#033457' }} />
                ) : (
                  <Icon icon="mdi:camera" style={{ fontSize: 14, color: '#033457' }} />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="d-none"
                />
              </label>
            </div>

            <div className="flex-grow-1">
              <h5 className="text-white fw-semibold mb-1">{currentUser?.fullName}</h5>
              <p className="text-secondary-light text-sm mb-1">{currentUser?.email}</p>
              <span
                className="badge fw-medium"
                style={{
                  background: currentUser?.role === 'admin' ? '#03FF0022' : '#6c757d22',
                  color: currentUser?.role === 'admin' ? '#03FF00' : '#6c757d',
                }}
              >
                {currentUser?.role}
              </span>
            </div>
          </div>

          {avatarUrl && (
            <div className="mt-3">
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={handleRemove}
                disabled={removing}
              >
                {removing ? (
                  <span className="spinner-border spinner-border-sm me-1" />
                ) : (
                  <Icon icon="mdi:delete-outline" className="me-1" style={{ fontSize: 14 }} />
                )}
                Remove Photo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
                    <td className="text-white text-sm fw-medium">
                      <div className="d-flex align-items-center gap-2">
                        <Avatar src={m.signedAvatarUrl} name={m.fullName} size={28} />
                        {m.fullName}
                      </div>
                    </td>
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
  const [prefs, setPrefs] = useState({});
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(res => res.json())
      .then(data => {
        setPrefs(data.preferences || {});
        setPrefsLoading(false);
      })
      .catch(() => setPrefsLoading(false));
  }, []);

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

  const toggleEmail = (type) => {
    setPrefs(prev => ({
      ...prev,
      [type]: { emailEnabled: prev[type]?.emailEnabled === false ? true : false },
    }));
  };

  const handleSavePrefs = async () => {
    setPrefsSaving(true);
    const prefsList = Object.entries(prefs).map(([type, val]) => ({
      type,
      emailEnabled: val.emailEnabled !== false,
    }));
    const result = await saveNotificationPreferences(prefsList);
    if (result.success) {
      toast.success('Notification preferences saved');
    } else {
      toast.error(result.error || 'Failed to save preferences');
    }
    setPrefsSaving(false);
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
        <div className="card-header d-flex align-items-center justify-content-between">
          <h6 className="text-white fw-semibold mb-0">Email Notification Preferences</h6>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSavePrefs}
            disabled={prefsSaving || prefsLoading}
          >
            {prefsSaving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
            Save Preferences
          </button>
        </div>
        <div className="card-body">
          <p className="text-secondary-light text-sm mb-3">
            In-app notifications are always on. Toggle email delivery per notification type.
          </p>
          {prefsLoading ? (
            <div className="text-center py-4">
              <span className="spinner-border spinner-border-sm text-secondary-light" />
            </div>
          ) : (
            Object.entries(NOTIFICATION_CATEGORIES).map(([category, types]) => (
              <div key={category} className="mb-4">
                <h6 className="text-secondary-light fw-medium text-xs text-uppercase mb-2" style={{ letterSpacing: '0.5px' }}>
                  {category}
                </h6>
                <div className="d-flex flex-column gap-1">
                  {types.map((type) => {
                    const emailOn = prefs[type]?.emailEnabled !== false;
                    return (
                      <div
                        key={type}
                        className="d-flex align-items-center justify-content-between p-2 rounded"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <span className="text-white text-sm">{typeLabel(type)}</span>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                          <div className="d-flex align-items-center gap-1">
                            <span className="text-secondary-light" style={{ fontSize: '11px' }}>In-app</span>
                            <div className="form-check form-switch mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked
                                disabled
                                style={{ opacity: 0.5 }}
                              />
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-1">
                            <span className="text-secondary-light" style={{ fontSize: '11px' }}>Email</span>
                            <div className="form-check form-switch mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={emailOn}
                                onChange={() => toggleEmail(type)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
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

const CALENDAR_COLOR_CATEGORIES = [
  { key: 'meeting', label: 'Meetings', icon: 'mdi:calendar-clock-outline' },
  { key: 'calcom', label: 'Cal.com Bookings', icon: 'mdi:calendar-check-outline' },
  { key: 'website', label: 'Website Bookings', icon: 'mdi:web' },
  { key: 'milestone', label: 'Milestones', icon: 'mdi:flag-checkered' },
  { key: 'milestone_overdue', label: 'Overdue Milestones', icon: 'mdi:alert-circle-outline' },
  { key: 'cancelled', label: 'Cancelled Events', icon: 'mdi:cancel' },
];

function CalendarTab({ initialColors }) {
  const [colors, setColors] = useState(() => ({
    ...DEFAULT_CALENDAR_COLORS,
    ...(initialColors || {}),
  }));
  const [saving, setSaving] = useState(false);

  const handleColorChange = (key, value) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveCalendarColors(colors);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Calendar colors saved.');
    }
  };

  const handleReset = () => {
    setColors({ ...DEFAULT_CALENDAR_COLORS });
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h6 className="text-white fw-semibold mb-0">Calendar Event Colors</h6>
        </div>
        <div className="card-body">
          <p className="text-secondary-light text-sm mb-4">
            Customize the colors used for each event category on the calendar.
          </p>
          <div className="d-flex flex-column gap-3">
            {CALENDAR_COLOR_CATEGORIES.map((cat) => (
              <div
                key={cat.key}
                className="d-flex align-items-center gap-3 p-3 rounded"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Icon
                  icon={cat.icon}
                  className="text-secondary-light flex-shrink-0"
                  style={{ fontSize: '20px' }}
                />
                <span className="text-white text-sm fw-medium flex-grow-1">
                  {cat.label}
                </span>

                {/* Color input (native picker) */}
                <div className="position-relative" style={{ width: 32, height: 32 }}>
                  <div
                    className="rounded"
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: colors[cat.key] || DEFAULT_CALENDAR_COLORS[cat.key],
                      border: '2px solid rgba(255,255,255,0.15)',
                      cursor: 'pointer',
                    }}
                  />
                  <input
                    type="color"
                    value={colors[cat.key] || DEFAULT_CALENDAR_COLORS[cat.key]}
                    onChange={(e) => handleColorChange(cat.key, e.target.value)}
                    className="position-absolute"
                    style={{
                      inset: 0,
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer',
                    }}
                  />
                </div>

                {/* Preset swatches */}
                <div className="d-flex gap-1 flex-wrap" style={{ maxWidth: 240 }}>
                  {CALENDAR_PRESET_COLORS.slice(0, 7).map((c) => (
                    <button
                      key={c}
                      className="btn p-0 border-0"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '3px',
                        backgroundColor: c,
                        outline: colors[cat.key] === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        outlineOffset: 1,
                        cursor: 'pointer',
                      }}
                      onClick={() => handleColorChange(cat.key, c)}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="d-flex gap-2 mt-4">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
              Save Colors
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleReset}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoDataTab() {
  const [resetting, setResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [demoActive, setDemoActive] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDemoActive(document.cookie.split(';').some(c => c.trim().startsWith('demo_mode=true')));
    }
  }, []);

  const handleReset = async () => {
    setResetting(true);
    setShowConfirm(false);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Demo data reset: ${data.deleted} records removed. Re-run seed-demo.mjs to repopulate.`);
      } else {
        toast.error(data.error || 'Reset failed.');
      }
    } catch {
      toast.error('Reset failed.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <div className="card mb-4">
        <div className="card-header">
          <h6 className="text-white fw-semibold mb-0">
            <Icon icon="mdi:play-circle-outline" className="me-2" style={{ fontSize: 18 }} />
            Demo Mode
          </h6>
        </div>
        <div className="card-body">
          <p className="text-secondary-light text-sm mb-3">
            Demo mode lets you show the CRM with realistic sample data during sales presentations.
            When active, all pages display demo data instead of real data. Each team member&apos;s session is independent.
          </p>

          <div className="d-flex align-items-center gap-2 mb-4">
            <span
              className="badge fw-medium"
              style={{
                background: demoActive ? '#7c3aed33' : '#6c757d22',
                color: demoActive ? '#a78bfa' : '#6c757d',
                fontSize: '12px',
              }}
            >
              {demoActive ? 'Demo Mode Active' : 'Demo Mode Off'}
            </span>
            <span className="text-secondary-light text-xs">
              Toggle from the header bar using the &quot;Demo&quot; button.
            </span>
          </div>

          <div
            className="p-3 rounded mb-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h6 className="text-white text-sm fw-semibold mb-2">How it works</h6>
            <ul className="text-secondary-light text-sm mb-0 ps-3">
              <li>Click the <strong>Demo</strong> button in the header to activate</li>
              <li>All pages will show only demo data (purple banner confirms it&apos;s active)</li>
              <li>Records created while in demo mode are automatically flagged as demo data</li>
              <li>Webhooks and cron jobs always use real data (unaffected)</li>
              <li>Click <strong>Deactivate</strong> to return to real data</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h6 className="text-white fw-semibold mb-0">Reset Demo Data</h6>
        </div>
        <div className="card-body">
          <p className="text-secondary-light text-sm mb-3">
            Delete all demo records from the database. After resetting, run{' '}
            <code className="text-white">node src/lib/db/seed-demo.mjs</code> to repopulate with fresh sample data.
          </p>

          {!showConfirm ? (
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => setShowConfirm(true)}
              disabled={resetting || !demoActive}
            >
              <Icon icon="mdi:delete-sweep-outline" className="me-1" style={{ fontSize: 16 }} />
              Reset Demo Data
            </button>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <span className="text-danger text-sm fw-medium">This will delete all demo records. Continue?</span>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleReset}
                disabled={resetting}
              >
                {resetting ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                Yes, Reset
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowConfirm(false)}
                disabled={resetting}
              >
                Cancel
              </button>
            </div>
          )}

          {!demoActive && (
            <p className="text-secondary-light text-xs mt-2 mb-0">
              Demo mode must be active to reset demo data.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
