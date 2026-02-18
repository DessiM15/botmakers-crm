'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { backfillSquareHistory } from '@/lib/actions/square-backfill';

const SettingsIntegrations = ({ githubConfigured, squareConfigured, squareEnvironment, siteUrl }) => {
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);

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

  return (
    <div className="row g-4">
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
