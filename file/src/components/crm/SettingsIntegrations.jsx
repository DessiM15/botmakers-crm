'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { backfillSquareHistory } from '@/lib/actions/square-backfill';
import { generateProjectTrackingApiKey } from '@/lib/actions/settings';
import { pullVercelCosts, pullAnthropicCosts } from '@/lib/actions/costs';

const SettingsIntegrations = ({
  githubConfigured,
  squareConfigured,
  squareEnvironment,
  calConfigured,
  googleCalendarConfigured,
  googleCalendarConnected,
  googleCalendarEmail,
  siteUrl,
  trackingKeyConfigured: initialTrackingConfigured,
  trackingKeyMasked: initialTrackingMasked,
  vercelBillingConfigured,
  anthropicBillingConfigured,
}) => {
  const searchParams = useSearchParams();
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [trackingConfigured, setTrackingConfigured] = useState(initialTrackingConfigured);
  const [trackingMasked, setTrackingMasked] = useState(initialTrackingMasked);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [pullingVercel, setPullingVercel] = useState(false);
  const [vercelPullResult, setVercelPullResult] = useState(null);
  const [pullingAnthropic, setPullingAnthropic] = useState(false);
  const [anthropicPullResult, setAnthropicPullResult] = useState(null);

  // Handle OAuth redirect params
  useEffect(() => {
    if (searchParams.get('google_success') === 'true') {
      toast.success('Google Calendar connected successfully');
      // Clean the URL
      window.history.replaceState({}, '', '/settings');
    }
    const googleError = searchParams.get('google_error');
    if (googleError) {
      const messages = {
        auth_required: 'Please sign in to connect Google Calendar',
        not_configured: 'Google Calendar is not configured',
        no_code: 'Authorization was not completed',
        state_mismatch: 'Security check failed — please try again',
        no_refresh_token: 'Could not get refresh token — please try again',
        exchange_failed: 'Failed to connect — please try again',
        access_denied: 'Access was denied — please try again',
      };
      toast.error(messages[googleError] || `Google Calendar error: ${googleError}`);
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    });
  };

  const handleBackfill = async () => {
    if (!window.confirm('This will import invoices and payments from Square into the CRM. Continue?')) return;

    setBackfilling(true);
    setBackfillResult(null);
    const res = await backfillSquareHistory();
    setBackfilling(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      setBackfillResult(res);
      toast.success(`Imported ${res.invoicesImported} invoices, ${res.paymentsImported} payments`);
    }
  };

  const handleGenerateKey = async () => {
    const msg = trackingConfigured
      ? 'This will replace the existing API key. All projects using the old key will need to re-download their CLAUDE.md. Continue?'
      : 'Generate a new Project Tracking API key?';
    if (!window.confirm(msg)) return;

    setGeneratingKey(true);
    const res = await generateProjectTrackingApiKey();
    setGeneratingKey(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      setTrackingConfigured(true);
      setTrackingMasked(res.maskedKey);
      toast.success('API key generated successfully');
    }
  };

  const handlePullVercel = async () => {
    setPullingVercel(true);
    setVercelPullResult(null);
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const startDate = prevMonth.toISOString().split('T')[0];
    const endDate = prevMonthEnd.toISOString().split('T')[0];
    const res = await pullVercelCosts(startDate, endDate);
    setPullingVercel(false);
    if (res?.error) {
      toast.error(res.error);
    } else {
      setVercelPullResult(res);
      toast.success(`Pulled ${res.inserted} Vercel cost entries`);
    }
  };

  const handlePullAnthropic = async () => {
    setPullingAnthropic(true);
    setAnthropicPullResult(null);
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const startDate = prevMonth.toISOString().split('T')[0];
    const endDate = prevMonthEnd.toISOString().split('T')[0];
    const res = await pullAnthropicCosts(startDate, endDate);
    setPullingAnthropic(false);
    if (res?.error) {
      toast.error(res.error);
    } else {
      setAnthropicPullResult(res);
      toast.success(`Pulled ${res.inserted} Anthropic cost entries`);
    }
  };

  return (
    <div className="row g-4">
      {/* Project Tracking API */}
      <div className="col-xl-6">
        <div className="card">
          <div className="card-header d-flex align-items-center gap-2">
            <Icon icon="mdi:robot-outline" className="text-white" style={{ fontSize: '24px' }} />
            <h6 className="text-white fw-semibold mb-0">Project Tracking API</h6>
          </div>
          <div className="card-body">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="text-secondary-light text-sm">API Key:</span>
              {trackingConfigured ? (
                <span className="badge bg-success bg-opacity-25 text-success">
                  <Icon icon="mdi:check-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Active
                </span>
              ) : (
                <span className="badge bg-secondary bg-opacity-25 text-secondary-light">
                  Not Configured
                </span>
              )}
            </div>

            {trackingConfigured && trackingMasked && (
              <div className="mb-3">
                <label className="text-secondary-light text-xs d-block mb-1">Key</label>
                <code className="text-info text-sm">{trackingMasked}</code>
              </div>
            )}

            <div className="mb-3">
              <label className="text-secondary-light text-xs d-block mb-1">
                API Endpoint
              </label>
              <div className="input-group input-group-sm">
                <input
                  type="text"
                  className="form-control bg-base text-white"
                  readOnly
                  value={`${siteUrl}/api/projects/track`}
                />
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => copyToClipboard(`${siteUrl}/api/projects/track`)}
                >
                  <Icon icon="mdi:content-copy" style={{ fontSize: '14px' }} />
                </button>
              </div>
            </div>

            <div className="mb-3">
              <button
                className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
                onClick={handleGenerateKey}
                disabled={generatingKey}
              >
                {generatingKey ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <Icon icon="mdi:key-plus" style={{ fontSize: '16px' }} />
                )}
                {trackingConfigured ? 'Regenerate Key' : 'Generate API Key'}
              </button>
            </div>

            <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <h6 className="text-white text-xs fw-semibold mb-2">How It Works</h6>
              <ol className="text-secondary-light text-xs mb-0 ps-3">
                <li className="mb-1">Generate an API key above</li>
                <li className="mb-1">Go to any Project &gt; Repos &amp; Demos tab</li>
                <li className="mb-1">Download the CLAUDE.md file</li>
                <li className="mb-1">Drop it in the client&apos;s repo root</li>
                <li>Claude Code will auto-update milestones as it works</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* GitHub */}
      <div className="col-xl-6">
        <div className="card">
          <div className="card-header d-flex align-items-center gap-2">
            <Icon icon="mdi:github" className="text-white" style={{ fontSize: '24px' }} />
            <h6 className="text-white fw-semibold mb-0">GitHub</h6>
          </div>
          <div className="card-body">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="text-secondary-light text-sm">Token Status:</span>
              {githubConfigured ? (
                <span className="badge bg-success bg-opacity-25 text-success">
                  <Icon icon="mdi:check-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Configured
                </span>
              ) : (
                <span className="badge bg-danger bg-opacity-25 text-danger">
                  <Icon icon="mdi:close-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Not Configured
                </span>
              )}
            </div>

            <div className="mb-3">
              <label className="text-secondary-light text-xs d-block mb-1">
                Webhook URL
              </label>
              <div className="input-group input-group-sm">
                <input
                  type="text"
                  className="form-control bg-base text-white"
                  readOnly
                  value={`${siteUrl}/api/webhooks/github`}
                />
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => copyToClipboard(`${siteUrl}/api/webhooks/github`)}
                >
                  <Icon icon="mdi:content-copy" style={{ fontSize: '14px' }} />
                </button>
              </div>
            </div>

            <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <h6 className="text-white text-xs fw-semibold mb-2">Setup Instructions</h6>
              <ol className="text-secondary-light text-xs mb-0 ps-3">
                <li className="mb-1">
                  Create a GitHub Personal Access Token at{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info text-decoration-none"
                  >
                    github.com/settings/tokens
                  </a>
                </li>
                <li className="mb-1">Select &quot;repo&quot; read permissions</li>
                <li className="mb-1">Add as GITHUB_TOKEN in your environment variables</li>
                <li className="mb-1">
                  (Optional) Set up a webhook in your repo settings with the URL above
                </li>
                <li>Set GITHUB_WEBHOOK_SECRET to match the webhook secret</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Vercel */}
      <div className="col-xl-6">
        <div className="card">
          <div className="card-header d-flex align-items-center gap-2">
            <Icon icon="mdi:triangle" className="text-white" style={{ fontSize: '24px' }} />
            <h6 className="text-white fw-semibold mb-0">Vercel</h6>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="text-secondary-light text-xs d-block mb-1">
                Webhook URL
              </label>
              <div className="input-group input-group-sm">
                <input
                  type="text"
                  className="form-control bg-base text-white"
                  readOnly
                  value={`${siteUrl}/api/webhooks/vercel`}
                />
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => copyToClipboard(`${siteUrl}/api/webhooks/vercel`)}
                >
                  <Icon icon="mdi:content-copy" style={{ fontSize: '14px' }} />
                </button>
              </div>
            </div>

            <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <h6 className="text-white text-xs fw-semibold mb-2">Setup Instructions</h6>
              <ol className="text-secondary-light text-xs mb-0 ps-3">
                <li className="mb-1">
                  Go to your Vercel project settings &gt; Webhooks
                </li>
                <li className="mb-1">Add a new webhook with the URL above</li>
                <li className="mb-1">Select &quot;Deployment Ready&quot; event</li>
                <li className="mb-1">Copy the webhook secret</li>
                <li>
                  Add as VERCEL_WEBHOOK_SECRET in your environment variables
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Square */}
      <div className="col-xl-6">
        <div className="card">
          <div className="card-header d-flex align-items-center gap-2">
            <Icon icon="mdi:square-rounded" className="text-white" style={{ fontSize: '24px' }} />
            <h6 className="text-white fw-semibold mb-0">Square</h6>
          </div>
          <div className="card-body">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="text-secondary-light text-sm">Status:</span>
              {squareConfigured ? (
                <span className="badge bg-success bg-opacity-25 text-success">
                  <Icon icon="mdi:check-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Configured
                </span>
              ) : (
                <span className="badge bg-danger bg-opacity-25 text-danger">
                  <Icon icon="mdi:close-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Not Configured
                </span>
              )}
            </div>

            {squareConfigured && (
              <>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span className="text-secondary-light text-sm">Environment:</span>
                  <span className={`badge ${squareEnvironment === 'production' ? 'bg-warning bg-opacity-25 text-warning' : 'bg-info bg-opacity-25 text-info'}`}>
                    {squareEnvironment === 'production' ? 'Production' : 'Sandbox'}
                  </span>
                </div>

                <div className="mb-3">
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Webhook URL
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      className="form-control bg-base text-white"
                      readOnly
                      value={`${siteUrl}/api/webhooks/square`}
                    />
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => copyToClipboard(`${siteUrl}/api/webhooks/square`)}
                    >
                      <Icon icon="mdi:content-copy" style={{ fontSize: '14px' }} />
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <button
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
                    onClick={handleBackfill}
                    disabled={backfilling}
                  >
                    {backfilling ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <Icon icon="mdi:database-import" style={{ fontSize: '16px' }} />
                    )}
                    {backfilling ? 'Importing...' : 'Backfill History'}
                  </button>
                </div>

                {backfillResult && (
                  <div className="p-3 rounded" style={{ background: 'rgba(3,255,0,0.05)' }}>
                    <p className="text-white text-xs fw-semibold mb-1">Backfill Complete</p>
                    <p className="text-secondary-light text-xs mb-0">
                      Invoices imported: {backfillResult.invoicesImported}<br />
                      Payments imported: {backfillResult.paymentsImported}
                      {backfillResult.errors?.length > 0 && (
                        <><br />Errors: {backfillResult.errors.length}</>
                      )}
                    </p>
                  </div>
                )}
              </>
            )}

            {!squareConfigured && (
              <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <h6 className="text-white text-xs fw-semibold mb-2">Setup Instructions</h6>
                <ol className="text-secondary-light text-xs mb-0 ps-3">
                  <li className="mb-1">Get credentials from Square Developer Dashboard</li>
                  <li className="mb-1">Add SQUARE_ACCESS_TOKEN to environment variables</li>
                  <li className="mb-1">Add SQUARE_APPLICATION_ID and SQUARE_LOCATION_ID</li>
                  <li className="mb-1">Set SQUARE_ENVIRONMENT to &quot;production&quot; or &quot;sandbox&quot;</li>
                  <li>Add SQUARE_WEBHOOK_SIGNATURE_KEY for webhook verification</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cal.com */}
      <div className="col-xl-6">
        <div className="card">
          <div className="card-header d-flex align-items-center gap-2">
            <Icon icon="mdi:calendar-check-outline" className="text-white" style={{ fontSize: '24px' }} />
            <h6 className="text-white fw-semibold mb-0">Cal.com</h6>
          </div>
          <div className="card-body">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="text-secondary-light text-sm">Status:</span>
              {calConfigured ? (
                <span className="badge bg-success bg-opacity-25 text-success">
                  <Icon icon="mdi:check-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Configured
                </span>
              ) : (
                <span className="badge bg-danger bg-opacity-25 text-danger">
                  <Icon icon="mdi:close-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Not Configured
                </span>
              )}
            </div>

            <div className="mb-3">
              <label className="text-secondary-light text-xs d-block mb-1">
                Webhook URL
              </label>
              <div className="input-group input-group-sm">
                <input
                  type="text"
                  className="form-control bg-base text-white"
                  readOnly
                  value={`${siteUrl}/api/webhooks/cal`}
                />
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => copyToClipboard(`${siteUrl}/api/webhooks/cal`)}
                >
                  <Icon icon="mdi:content-copy" style={{ fontSize: '14px' }} />
                </button>
              </div>
            </div>

            <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <h6 className="text-white text-xs fw-semibold mb-2">Setup Instructions</h6>
              <ol className="text-secondary-light text-xs mb-0 ps-3">
                <li className="mb-1">Go to Cal.com &gt; Settings &gt; Developer &gt; Webhooks</li>
                <li className="mb-1">Add a new webhook with the URL above</li>
                <li className="mb-1">Select events: Booking Created, Rescheduled, Cancelled</li>
                <li className="mb-1">Set a webhook secret</li>
                <li>Add the secret as CAL_WEBHOOK_SECRET in your environment variables</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Google Calendar */}
      <div className="col-xl-6">
        <div className="card">
          <div className="card-header d-flex align-items-center gap-2">
            <Icon icon="mdi:google" className="text-white" style={{ fontSize: '24px' }} />
            <h6 className="text-white fw-semibold mb-0">Google Calendar</h6>
          </div>
          <div className="card-body">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="text-secondary-light text-sm">Status:</span>
              {googleCalendarConnected ? (
                <span className="badge bg-success bg-opacity-25 text-success">
                  <Icon icon="mdi:check-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Connected
                </span>
              ) : googleCalendarConfigured ? (
                <span className="badge bg-warning bg-opacity-25 text-warning">
                  <Icon icon="mdi:alert-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Not Connected
                </span>
              ) : (
                <span className="badge bg-danger bg-opacity-25 text-danger">
                  <Icon icon="mdi:close-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Not Configured
                </span>
              )}
            </div>

            {googleCalendarConnected && (
              <>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span className="text-secondary-light text-sm">Account:</span>
                  <span className="text-white text-sm">{googleCalendarEmail}</span>
                </div>

                <div className="d-flex gap-2 mb-3">
                  <button
                    className="btn btn-sm d-flex align-items-center gap-2"
                    style={{ background: '#03FF00', color: '#000', fontWeight: 500 }}
                    onClick={async () => {
                      setSyncing(true);
                      setSyncResult(null);
                      // Retry up to 3 times — dev server manifest can be temporarily unavailable
                      let lastErr = null;
                      for (let attempt = 0; attempt < 3; attempt++) {
                        try {
                          if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
                          const resp = await fetch('/api/calendar/sync');
                          const res = await resp.json();
                          setSyncing(false);
                          if (!resp.ok || res?.error) {
                            toast.error(res?.error || 'Sync failed');
                          } else {
                            setSyncResult(res);
                            toast.success(`Synced ${res.synced || 0} events`);
                          }
                          return;
                        } catch (err) {
                          lastErr = err;
                        }
                      }
                      setSyncing(false);
                      toast.error('Sync failed after retries — try refreshing the page first');
                    }}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <Icon icon="mdi:sync" style={{ fontSize: '16px' }} />
                    )}
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button
                    className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2"
                    onClick={async () => {
                      if (!window.confirm('Disconnect Google Calendar? Events will remain but won\'t be updated.')) return;
                      setDisconnecting(true);
                      try {
                        const resp = await fetch('/api/calendar/disconnect', { method: 'POST' });
                        const res = await resp.json();
                        setDisconnecting(false);
                        if (!resp.ok || res?.error) {
                          toast.error(res?.error || 'Failed to disconnect');
                        } else {
                          toast.success('Google Calendar disconnected');
                          window.location.reload();
                        }
                      } catch (err) {
                        setDisconnecting(false);
                        toast.error('Failed to disconnect — check console');
                      }
                    }}
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <Icon icon="mdi:link-off" style={{ fontSize: '16px' }} />
                    )}
                    Disconnect
                  </button>
                </div>

                {syncResult && (
                  <div className="p-3 rounded mb-3" style={{ background: 'rgba(3,255,0,0.05)' }}>
                    <p className="text-white text-xs fw-semibold mb-1">Sync Complete</p>
                    <p className="text-secondary-light text-xs mb-0">
                      Events synced: {syncResult.synced || 0}
                      {syncResult.errors?.length > 0 && (
                        <><br />Errors: {syncResult.errors.length}</>
                      )}
                    </p>
                  </div>
                )}

                <div className="mb-0">
                  <label className="text-secondary-light text-xs d-block mb-1">
                    Cron URL (for automated sync)
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      className="form-control bg-base text-white"
                      readOnly
                      value={`${siteUrl}/api/cron/sync-calendar`}
                    />
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => copyToClipboard(`${siteUrl}/api/cron/sync-calendar`)}
                    >
                      <Icon icon="mdi:content-copy" style={{ fontSize: '14px' }} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {googleCalendarConfigured && !googleCalendarConnected && (
              <a
                href="/auth/google"
                className="btn btn-primary btn-sm d-flex align-items-center gap-2"
                style={{ width: 'fit-content' }}
              >
                <Icon icon="mdi:google" style={{ fontSize: '16px' }} />
                Connect Google Calendar
              </a>
            )}

            {!googleCalendarConfigured && (
              <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <h6 className="text-white text-xs fw-semibold mb-2">Setup Instructions</h6>
                <ol className="text-secondary-light text-xs mb-0 ps-3">
                  <li className="mb-1">Create a project in the Google Cloud Console</li>
                  <li className="mb-1">Enable the Google Calendar API</li>
                  <li className="mb-1">Create OAuth 2.0 credentials (Web application)</li>
                  <li className="mb-1">Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to env vars</li>
                  <li>Set GOOGLE_REDIRECT_URI to <code>{siteUrl}/api/auth/google/callback</code></li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vercel Billing */}
      <div className="col-xl-6">
        <div className="card">
          <div className="card-header d-flex align-items-center gap-2">
            <Icon icon="mdi:triangle" className="text-white" style={{ fontSize: '24px' }} />
            <h6 className="text-white fw-semibold mb-0">Vercel Billing</h6>
          </div>
          <div className="card-body">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="text-secondary-light text-sm">API Token:</span>
              {vercelBillingConfigured ? (
                <span className="badge bg-success bg-opacity-25 text-success">
                  <Icon icon="mdi:check-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Configured
                </span>
              ) : (
                <span className="badge bg-secondary bg-opacity-25 text-secondary-light">
                  Not Configured
                </span>
              )}
            </div>

            {vercelBillingConfigured && (
              <>
                <button
                  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2 mb-3"
                  onClick={handlePullVercel}
                  disabled={pullingVercel}
                >
                  {pullingVercel ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <Icon icon="mdi:cloud-download-outline" style={{ fontSize: '16px' }} />
                  )}
                  {pullingVercel ? 'Pulling...' : 'Pull Last Month Costs'}
                </button>

                {vercelPullResult && (
                  <div className="p-3 rounded" style={{ background: 'rgba(3,255,0,0.05)' }}>
                    <p className="text-white text-xs fw-semibold mb-1">Pull Complete</p>
                    <p className="text-secondary-light text-xs mb-0">
                      Entries created: {vercelPullResult.inserted}
                    </p>
                  </div>
                )}
              </>
            )}

            {!vercelBillingConfigured && (
              <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-secondary-light text-xs mb-0">
                  Set <code>VERCEL_API_TOKEN</code> and optionally <code>VERCEL_TEAM_ID</code> in your environment variables to enable automatic cost pulling from Vercel.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Anthropic Billing */}
      <div className="col-xl-6">
        <div className="card">
          <div className="card-header d-flex align-items-center gap-2">
            <Icon icon="mdi:robot-outline" className="text-white" style={{ fontSize: '24px' }} />
            <h6 className="text-white fw-semibold mb-0">Anthropic Billing</h6>
          </div>
          <div className="card-body">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="text-secondary-light text-sm">Admin API Key:</span>
              {anthropicBillingConfigured ? (
                <span className="badge bg-success bg-opacity-25 text-success">
                  <Icon icon="mdi:check-circle" className="me-1" style={{ fontSize: '14px' }} />
                  Configured
                </span>
              ) : (
                <span className="badge bg-secondary bg-opacity-25 text-secondary-light">
                  Not Configured
                </span>
              )}
            </div>

            {anthropicBillingConfigured && (
              <>
                <button
                  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2 mb-3"
                  onClick={handlePullAnthropic}
                  disabled={pullingAnthropic}
                >
                  {pullingAnthropic ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <Icon icon="mdi:cloud-download-outline" style={{ fontSize: '16px' }} />
                  )}
                  {pullingAnthropic ? 'Pulling...' : 'Pull Last Month Costs'}
                </button>

                {anthropicPullResult && (
                  <div className="p-3 rounded" style={{ background: 'rgba(3,255,0,0.05)' }}>
                    <p className="text-white text-xs fw-semibold mb-1">Pull Complete</p>
                    <p className="text-secondary-light text-xs mb-0">
                      Entries created: {anthropicPullResult.inserted}
                    </p>
                  </div>
                )}
              </>
            )}

            {!anthropicBillingConfigured && (
              <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-secondary-light text-xs mb-0">
                  Set <code>ANTHROPIC_ADMIN_API_KEY</code> in your environment variables to enable automatic cost pulling from Anthropic. This is separate from the regular ANTHROPIC_API_KEY used for AI features.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resend */}
      <div className="col-xl-6">
        <div className="card">
          <div className="card-header d-flex align-items-center gap-2">
            <Icon icon="mdi:email-fast-outline" className="text-white" style={{ fontSize: '24px' }} />
            <h6 className="text-white fw-semibold mb-0">Resend (Email)</h6>
          </div>
          <div className="card-body">
            <div className="d-flex align-items-center gap-2">
              <span className="text-secondary-light text-sm">Status:</span>
              <span className="badge bg-success bg-opacity-25 text-success">
                <Icon icon="mdi:check-circle" className="me-1" style={{ fontSize: '14px' }} />
                Configured
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsIntegrations;
