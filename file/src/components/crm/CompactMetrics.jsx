import { Icon } from '@iconify/react';
import { formatCurrency } from '@/lib/utils/formatters';

const items = [
  {
    key: 'leadsThisWeek',
    label: 'Leads',
    icon: 'solar:users-group-two-rounded-bold',
    color: '#0dcaf0',
    format: (v) => v.toLocaleString(),
    deltaKey: 'leadsDelta',
  },
  {
    key: 'pipelineValue',
    label: 'Pipeline',
    icon: 'solar:chart-2-bold',
    color: '#6f42c1',
    format: (v) => formatCurrency(v),
  },
  {
    key: 'activeProjects',
    label: 'Active',
    icon: 'solar:code-bold',
    color: '#0d6efd',
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'revenueThisMonth',
    label: 'Revenue',
    icon: 'solar:wallet-bold',
    color: '#03FF00',
    format: (v) => formatCurrency(v),
  },
];

const CompactMetrics = ({ metrics }) => {
  return (
    <div
      className="d-flex flex-wrap align-items-center gap-0 rounded-3"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {items.map((item, idx) => {
        const value = metrics[item.key] ?? 0;
        const delta = item.deltaKey ? metrics[item.deltaKey] : null;
        return (
          <div
            key={item.key}
            className="d-flex align-items-center gap-2 px-3 py-2 flex-grow-1"
            style={{
              borderRight: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              minWidth: '140px',
            }}
          >
            <div
              className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
              style={{
                width: '32px',
                height: '32px',
                background: `${item.color}18`,
                color: item.color,
              }}
            >
              <Icon icon={item.icon} style={{ fontSize: '16px' }} />
            </div>
            <div>
              <div className="text-white fw-semibold text-sm" style={{ lineHeight: 1.2 }}>
                {item.format(value)}
                {delta !== null && (
                  <span
                    className="ms-1"
                    style={{
                      fontSize: '10px',
                      color: delta >= 0 ? '#03FF00' : '#dc3545',
                    }}
                  >
                    {delta >= 0 ? `+${delta}` : delta}
                  </span>
                )}
              </div>
              <div className="text-secondary-light" style={{ fontSize: '11px', lineHeight: 1.2 }}>
                {item.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CompactMetrics;
