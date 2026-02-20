import { Icon } from '@iconify/react';

const SOURCE_CONFIG = {
  web_form: { label: 'Web Form', icon: 'mdi:web', color: '#0dcaf0' },
  referral: { label: 'Referral', icon: 'mdi:account-group', color: '#198754' },
  vapi: { label: 'Vapi (Voice)', icon: 'mdi:phone-in-talk', color: '#6f42c1' },
  cold_outreach: { label: 'Cold Outreach', icon: 'mdi:email-fast-outline', color: '#fd7e14' },
  word_of_mouth: { label: 'Word of Mouth', icon: 'mdi:chat-outline', color: '#e91e63' },
  other: { label: 'Other', icon: 'mdi:dots-horizontal-circle-outline', color: '#6c757d' },
};

const LeadSourceAnalytics = ({ sources }) => {
  const totalLeads = sources.reduce((s, r) => s + r.total, 0);

  return (
    <div className="card h-100">
      <div className="card-header border-bottom d-flex align-items-center justify-content-between">
        <h6 className="text-lg fw-semibold mb-0">Lead Sources</h6>
        <span className="text-secondary-light text-xs">Last 90 days</span>
      </div>
      <div className="card-body p-0">
        {sources.length === 0 ? (
          <div className="text-center py-4">
            <Icon
              icon="mdi:chart-bar"
              className="text-secondary-light mb-2"
              style={{ fontSize: '36px' }}
            />
            <p className="text-secondary-light text-sm mb-0">No lead data yet</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th className="text-xs fw-medium ps-3" style={{ color: '#666' }}>Source</th>
                  <th className="text-xs fw-medium text-center" style={{ color: '#666' }}>Leads</th>
                  <th className="text-xs fw-medium text-center" style={{ color: '#666' }}>Converted</th>
                  <th className="text-xs fw-medium text-end pe-3" style={{ color: '#666' }}>Conv. Rate</th>
                </tr>
              </thead>
              <tbody>
                {sources
                  .sort((a, b) => b.total - a.total)
                  .map((row) => {
                    const config = SOURCE_CONFIG[row.source] || SOURCE_CONFIG.other;
                    const pct = totalLeads > 0 ? Math.round((row.total / totalLeads) * 100) : 0;
                    return (
                      <tr key={row.source}>
                        <td className="ps-3">
                          <div className="d-flex align-items-center gap-2">
                            <Icon
                              icon={config.icon}
                              style={{ fontSize: '16px', color: config.color }}
                            />
                            <span className="text-sm" style={{ color: '#333' }}>{config.label}</span>
                            <span className="text-xs" style={{ color: '#888' }}>({pct}%)</span>
                          </div>
                        </td>
                        <td className="text-center">
                          <span className="text-sm fw-medium" style={{ color: '#333' }}>{row.total}</span>
                        </td>
                        <td className="text-center">
                          <span className="text-sm" style={{ color: '#333' }}>{row.converted}</span>
                        </td>
                        <td className="text-end pe-3">
                          <span
                            className="badge text-xs"
                            style={{
                              background: row.conversionRate >= 50
                                ? 'rgba(25,135,84,0.15)'
                                : row.conversionRate >= 25
                                ? 'rgba(255,193,7,0.15)'
                                : 'rgba(108,117,125,0.15)',
                              color: row.conversionRate >= 50
                                ? '#198754'
                                : row.conversionRate >= 25
                                ? '#ffc107'
                                : '#6c757d',
                            }}
                          >
                            {row.conversionRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadSourceAnalytics;
