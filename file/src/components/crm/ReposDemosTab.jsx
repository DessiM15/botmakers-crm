'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { linkRepo, unlinkRepo, syncRepo, createDemo, deleteDemo, toggleDemoApproval } from '@/lib/actions/repos';
import { formatDate, formatRelativeTime } from '@/lib/utils/formatters';

const ReposDemosTab = ({ projectId, repos: initialRepos, demos: initialDemos, phases }) => {
  const [repos, setRepos] = useState(initialRepos || []);
  const [demos, setDemos] = useState(initialDemos || []);

  return (
    <div className="row g-4">
      <div className="col-xl-6">
        <ReposSection projectId={projectId} repos={repos} setRepos={setRepos} />
      </div>
      <div className="col-xl-6">
        <DemosSection projectId={projectId} demos={demos} setDemos={setDemos} phases={phases} />
      </div>
    </div>
  );
};

// ── Repos Section ──────────────────────────────────────────────────────────────

const ReposSection = ({ projectId, repos, setRepos }) => {
  const [owner, setOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [linking, setLinking] = useState(false);
  const [expandedRepo, setExpandedRepo] = useState(null);
  const [commits, setCommits] = useState({});
  const [syncing, setSyncing] = useState({});

  const handleLink = async (e) => {
    e.preventDefault();
    if (!owner.trim() || !repoName.trim()) return;
    setLinking(true);

    const res = await linkRepo(projectId, owner, repoName);
    setLinking(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Repository linked');
      setRepos((prev) => [res.repo, ...prev]);
      setOwner('');
      setRepoName('');
    }
  };

  const handleUnlink = async (repoId) => {
    if (!confirm('Unlink this repository?')) return;

    const res = await unlinkRepo(repoId, projectId);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Repository unlinked');
      setRepos((prev) => prev.filter((r) => r.id !== repoId));
      if (expandedRepo === repoId) setExpandedRepo(null);
    }
  };

  const handleSync = async (repoId) => {
    setSyncing((prev) => ({ ...prev, [repoId]: true }));

    const res = await syncRepo(repoId);
    setSyncing((prev) => ({ ...prev, [repoId]: false }));

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Synced');
      setCommits((prev) => ({ ...prev, [repoId]: res.commits }));
      setRepos((prev) =>
        prev.map((r) =>
          r.id === repoId ? { ...r, lastSyncedAt: new Date().toISOString() } : r
        )
      );
    }
  };

  const handleExpand = async (repoId) => {
    if (expandedRepo === repoId) {
      setExpandedRepo(null);
      return;
    }
    setExpandedRepo(repoId);
    if (!commits[repoId]) {
      await handleSync(repoId);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h6 className="text-white fw-semibold mb-0 d-flex align-items-center gap-2">
          <Icon icon="mdi:github" style={{ fontSize: '20px' }} />
          Repositories
        </h6>
      </div>
      <div className="card-body">
        {/* Link Repo Form */}
        <form onSubmit={handleLink} className="d-flex gap-2 mb-4">
          <input
            type="text"
            className="form-control bg-base text-white"
            placeholder="Owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            disabled={linking}
            style={{ maxWidth: '140px' }}
          />
          <span className="text-secondary-light align-self-center">/</span>
          <input
            type="text"
            className="form-control bg-base text-white"
            placeholder="Repository"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            disabled={linking}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm text-nowrap"
            disabled={linking || !owner.trim() || !repoName.trim()}
          >
            {linking ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              <>
                <Icon icon="mdi:link-plus" className="me-1" style={{ fontSize: '16px' }} />
                Link
              </>
            )}
          </button>
        </form>

        {/* Repos List */}
        {repos.length === 0 ? (
          <div className="text-center py-4">
            <Icon icon="mdi:source-repository" className="text-secondary-light mb-2" style={{ fontSize: '32px' }} />
            <p className="text-secondary-light text-sm mb-0">
              No repositories linked yet.
            </p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {repos.map((repo) => (
              <div key={repo.id}>
                <div
                  className="d-flex align-items-center gap-2 p-3 rounded"
                  style={{ background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
                  onClick={() => handleExpand(repo.id)}
                >
                  <Icon
                    icon={expandedRepo === repo.id ? 'mdi:chevron-down' : 'mdi:chevron-right'}
                    className="text-secondary-light"
                    style={{ fontSize: '18px' }}
                  />
                  <Icon icon="mdi:github" className="text-white" style={{ fontSize: '18px' }} />
                  <div className="flex-grow-1">
                    <a
                      href={repo.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white text-sm fw-medium text-decoration-none"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {repo.githubOwner}/{repo.githubRepo}
                    </a>
                    <div className="d-flex gap-3 mt-1">
                      <span className="text-secondary-light text-xs">
                        <Icon icon="mdi:source-branch" className="me-1" style={{ fontSize: '12px' }} />
                        {repo.defaultBranch}
                      </span>
                      {repo.lastSyncedAt && (
                        <span className="text-secondary-light text-xs">
                          Synced {formatRelativeTime(repo.lastSyncedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    title="Sync"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSync(repo.id);
                    }}
                    disabled={syncing[repo.id]}
                  >
                    {syncing[repo.id] ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <Icon icon="mdi:refresh" style={{ fontSize: '16px' }} />
                    )}
                  </button>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    title="Unlink"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnlink(repo.id);
                    }}
                  >
                    <Icon icon="mdi:link-off" style={{ fontSize: '16px' }} />
                  </button>
                </div>

                {/* Commits Panel */}
                {expandedRepo === repo.id && (
                  <div className="ms-4 mt-2 mb-2">
                    {syncing[repo.id] && !commits[repo.id] ? (
                      <div className="text-center py-3">
                        <span className="spinner-border spinner-border-sm text-secondary-light" />
                        <span className="text-secondary-light text-xs ms-2">Loading commits...</span>
                      </div>
                    ) : commits[repo.id]?.length > 0 ? (
                      <div className="d-flex flex-column gap-1">
                        {commits[repo.id].map((commit) => (
                          <div
                            key={commit.sha}
                            className="d-flex align-items-start gap-2 p-2 rounded"
                            style={{ background: 'rgba(255,255,255,0.02)' }}
                          >
                            <code className="text-info text-xs" style={{ minWidth: '56px' }}>
                              {commit.shortSha}
                            </code>
                            <div className="flex-grow-1">
                              <a
                                href={commit.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white text-xs text-decoration-none d-block"
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '280px',
                                }}
                              >
                                {commit.message}
                              </a>
                              <span className="text-secondary-light text-xs">
                                {commit.author} &middot; {formatRelativeTime(commit.date)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-secondary-light text-xs mb-0 py-2">No commits found.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Demos Section ──────────────────────────────────────────────────────────────

const DemosSection = ({ projectId, demos, setDemos, phases }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', description: '', phaseId: '' });
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;
    setCreating(true);

    const res = await createDemo(projectId, {
      title: form.title,
      url: form.url,
      description: form.description,
      phaseId: form.phaseId || null,
    });
    setCreating(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Demo link added');
      setDemos((prev) => [res.demo, ...prev]);
      setForm({ title: '', url: '', description: '', phaseId: '' });
      setShowForm(false);
    }
  };

  const handleDelete = async (demoId) => {
    if (!confirm('Delete this demo link?')) return;

    const res = await deleteDemo(demoId, projectId);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Demo deleted');
      setDemos((prev) => prev.filter((d) => d.id !== demoId));
    }
  };

  const handleToggleApproval = async (demoId) => {
    const res = await toggleDemoApproval(demoId, projectId);
    if (res?.error) {
      toast.error(res.error);
    } else {
      setDemos((prev) =>
        prev.map((d) =>
          d.id === demoId ? { ...d, isApproved: res.isApproved } : d
        )
      );
      toast.success(res.isApproved ? 'Demo approved for clients' : 'Demo unapproved');
    }
  };

  const getPhaseLabel = (phaseId) => {
    if (!phaseId || !phases) return null;
    const phase = phases.find((p) => p.id === phaseId);
    return phase ? phase.name : null;
  };

  return (
    <div className="card">
      <div className="card-header d-flex align-items-center justify-content-between">
        <h6 className="text-white fw-semibold mb-0 d-flex align-items-center gap-2">
          <Icon icon="mdi:monitor-screenshot" style={{ fontSize: '20px' }} />
          Demos
        </h6>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowForm(!showForm)}
        >
          <Icon icon={showForm ? 'mdi:close' : 'mdi:plus'} className="me-1" style={{ fontSize: '16px' }} />
          {showForm ? 'Cancel' : 'Add Demo'}
        </button>
      </div>
      <div className="card-body">
        {/* Add Demo Form */}
        {showForm && (
          <form onSubmit={handleCreate} className="mb-4 p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="row g-2 mb-2">
              <div className="col-sm-6">
                <input
                  type="text"
                  className="form-control form-control-sm bg-base text-white"
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  disabled={creating}
                />
              </div>
              <div className="col-sm-6">
                <input
                  type="url"
                  className="form-control form-control-sm bg-base text-white"
                  placeholder="https://..."
                  value={form.url}
                  onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                  disabled={creating}
                />
              </div>
            </div>
            <div className="row g-2 mb-2">
              <div className="col-sm-8">
                <input
                  type="text"
                  className="form-control form-control-sm bg-base text-white"
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  disabled={creating}
                />
              </div>
              <div className="col-sm-4">
                <select
                  className="form-select form-select-sm bg-base text-white"
                  value={form.phaseId}
                  onChange={(e) => setForm((prev) => ({ ...prev, phaseId: e.target.value }))}
                  disabled={creating}
                >
                  <option value="">Phase (optional)</option>
                  {phases?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={creating || !form.title.trim() || !form.url.trim()}
            >
              {creating ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" />
                  Adding...
                </>
              ) : (
                'Add Demo Link'
              )}
            </button>
          </form>
        )}

        {/* Demos List */}
        {demos.length === 0 ? (
          <div className="text-center py-4">
            <Icon icon="mdi:web" className="text-secondary-light mb-2" style={{ fontSize: '32px' }} />
            <p className="text-secondary-light text-sm mb-0">
              No demo links yet.
            </p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {demos.map((demo) => (
              <div
                key={demo.id}
                className="d-flex align-items-start gap-3 p-3 rounded"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <Icon icon="mdi:open-in-new" className="text-info mt-1" style={{ fontSize: '18px' }} />
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <a
                      href={demo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white text-sm fw-medium text-decoration-none"
                    >
                      {demo.title}
                    </a>
                    {demo.isAutoPulled && (
                      <span className="badge bg-info bg-opacity-25 text-info text-xs">
                        Auto-pulled
                      </span>
                    )}
                    {demo.isApproved ? (
                      <span className="badge bg-success bg-opacity-25 text-success text-xs">
                        Approved
                      </span>
                    ) : (
                      <span className="badge bg-warning bg-opacity-25 text-warning text-xs">
                        Not approved
                      </span>
                    )}
                    {getPhaseLabel(demo.phaseId) && (
                      <span className="badge bg-secondary bg-opacity-25 text-secondary-light text-xs">
                        {getPhaseLabel(demo.phaseId)}
                      </span>
                    )}
                  </div>
                  {demo.description && (
                    <p className="text-secondary-light text-xs mb-0 mt-1">
                      {demo.description}
                    </p>
                  )}
                  <span className="text-secondary-light text-xs">
                    Added {formatDate(demo.createdAt)}
                  </span>
                </div>
                <div className="d-flex gap-1">
                  <button
                    className={`btn btn-sm ${demo.isApproved ? 'btn-outline-warning' : 'btn-outline-success'}`}
                    title={demo.isApproved ? 'Unapprove' : 'Approve for clients'}
                    onClick={() => handleToggleApproval(demo.id)}
                  >
                    <Icon
                      icon={demo.isApproved ? 'mdi:eye-off-outline' : 'mdi:eye-check-outline'}
                      style={{ fontSize: '16px' }}
                    />
                  </button>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    title="Delete"
                    onClick={() => handleDelete(demo.id)}
                  >
                    <Icon icon="mdi:trash-can-outline" style={{ fontSize: '16px' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReposDemosTab;
