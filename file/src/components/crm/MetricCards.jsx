import Link from 'next/link';
import { Icon } from '@iconify/react';
import { formatCurrency } from '@/lib/utils/formatters';

const SOURCE_LABELS = {
  web_form: 'Web',
  referral: 'Referral',
  vapi: 'Vapi',
  cold_outreach: 'Outreach',
  word_of_mouth: 'WoM',
  other: 'Other',
};

const MetricCards = ({ metrics }) => {
  const leadsWeek = metrics.leadsThisWeek ?? 0;
  const leadsDelta = metrics.leadsDelta ?? 0;
  const leadsMonth = metrics.leadsThisMonth ?? 0;
  const leadsQuarter = metrics.leadsThisQuarter ?? 0;
  const leadsYear = metrics.leadsThisYear ?? 0;
  const sourceBreakdown = metrics.leadSourceBreakdown ?? [];

  const proposalAmt = metrics.outstandingProposalsAmount ?? 0;
  const proposalCount = metrics.outstandingProposalsCount ?? 0;

  const invoiceAmt = metrics.outstandingInvoicesAmount ?? 0;
  const invoiceCount = metrics.outstandingInvoicesCount ?? 0;

  const activeProjects = metrics.activeProjects ?? 0;
  const revenueThisMonth = metrics.revenueThisMonth ?? 0;

  return (
    <div className="row row-cols-xxl-5 row-cols-lg-3 row-cols-md-2 row-cols-1 gy-4">
      {metrics._error && (
        <div className="col-12">
          <div className="text-warning-main text-xs d-flex align-items-center gap-1 mb-2">
            <Icon icon="mdi:alert-circle-outline" className="text-sm" />
            Some metrics could not be loaded
          </div>
        </div>
      )}

      {/* Leads — combined card (Fix 4) */}
      <div className="col">
        <Link href="/leads" className="text-decoration-none">
          <div className="card shadow-none border bg-gradient-start-1 h-100" style={{ cursor: 'pointer' }}>
            <div className="card-body p-20">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                  <p className="fw-medium text-primary-light mb-1">Leads</p>
                  <h6 className="mb-0">{leadsWeek} this week</h6>
                </div>
                <div className="w-50-px h-50-px bg-cyan rounded-circle d-flex justify-content-center align-items-center">
                  <Icon icon="solar:users-group-two-rounded-bold" className="text-white text-2xl mb-0" />
                </div>
              </div>
              <div className="mt-12 d-flex flex-wrap gap-2 text-xs text-primary-light">
                <span>{leadsMonth} mo</span>
                <span className="text-secondary-light">|</span>
                <span>{leadsQuarter} qtr</span>
                <span className="text-secondary-light">|</span>
                <span>{leadsYear} yr</span>
              </div>
              {sourceBreakdown.length > 0 && (
                <div className="mt-8 d-flex flex-wrap gap-2 text-xs text-primary-light">
                  {sourceBreakdown.map((s) => (
                    <span key={s.source}>{SOURCE_LABELS[s.source] || s.source} ({s.count})</span>
                  ))}
                </div>
              )}
              {leadsDelta !== 0 && (
                <p className="fw-medium text-sm text-primary-light mt-8 mb-0 d-flex align-items-center gap-2">
                  <span className={`d-inline-flex align-items-center gap-1 ${leadsDelta >= 0 ? 'text-success-main' : 'text-danger-main'}`}>
                    <Icon icon={leadsDelta >= 0 ? 'bxs:up-arrow' : 'bxs:down-arrow'} className="text-xs" />
                    {leadsDelta >= 0 ? `+${leadsDelta}` : leadsDelta}
                  </span>
                  vs last week
                </p>
              )}
            </div>
          </div>
        </Link>
      </div>

      {/* Outstanding Proposals (Fix 2) */}
      <div className="col">
        <Link href="/proposals?status=sent" className="text-decoration-none">
          <div className="card shadow-none border bg-gradient-start-2 h-100" style={{ cursor: 'pointer' }}>
            <div className="card-body p-20">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                  <p className="fw-medium text-primary-light mb-1">Proposals Out</p>
                  <h6 className="mb-0">
                    {formatCurrency(proposalAmt)}{' '}
                    <span className="text-sm fw-normal text-primary-light">({proposalCount} proposal{proposalCount !== 1 ? 's' : ''})</span>
                  </h6>
                </div>
                <div className="w-50-px h-50-px bg-purple rounded-circle d-flex justify-content-center align-items-center">
                  <Icon icon="solar:document-bold" className="text-white text-2xl mb-0" />
                </div>
              </div>
              <p className="fw-medium text-sm text-primary-light mt-12 mb-0">sent or viewed</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Invoices Out (Fix 3) */}
      <div className="col">
        <Link href="/invoices?status=sent" className="text-decoration-none">
          <div className="card shadow-none border bg-gradient-start-5 h-100" style={{ cursor: 'pointer' }}>
            <div className="card-body p-20">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                  <p className="fw-medium text-primary-light mb-1">Invoices Out</p>
                  <h6 className="mb-0">
                    {formatCurrency(invoiceAmt)}{' '}
                    <span className="text-sm fw-normal text-primary-light">({invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''})</span>
                  </h6>
                </div>
                <div className="w-50-px h-50-px bg-warning-main rounded-circle d-flex justify-content-center align-items-center">
                  <Icon icon="solar:wallet-bold" className="text-white text-2xl mb-0" />
                </div>
              </div>
              <p className="fw-medium text-sm text-primary-light mt-12 mb-0">outstanding</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Active Projects */}
      <div className="col">
        <div className="card shadow-none border bg-gradient-start-3 h-100">
          <div className="card-body p-20">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <p className="fw-medium text-primary-light mb-1">Active Projects</p>
                <h6 className="mb-0">{activeProjects.toLocaleString()}</h6>
              </div>
              <div className="w-50-px h-50-px bg-info rounded-circle d-flex justify-content-center align-items-center">
                <Icon icon="solar:code-bold" className="text-white text-2xl mb-0" />
              </div>
            </div>
            <p className="fw-medium text-sm text-primary-light mt-12 mb-0">in progress</p>
          </div>
        </div>
      </div>

      {/* Revenue This Month */}
      <div className="col">
        <div className="card shadow-none border bg-gradient-start-4 h-100">
          <div className="card-body p-20">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <p className="fw-medium text-primary-light mb-1">Revenue This Month</p>
                <h6 className="mb-0">{formatCurrency(revenueThisMonth)}</h6>
              </div>
              <div className="w-50-px h-50-px bg-success-main rounded-circle d-flex justify-content-center align-items-center">
                <Icon icon="solar:wallet-bold" className="text-white text-2xl mb-0" />
              </div>
            </div>
            <p className="fw-medium text-sm text-primary-light mt-12 mb-0">payments received</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricCards;
