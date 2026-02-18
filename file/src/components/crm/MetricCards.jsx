import { Icon } from '@iconify/react';
import { formatCurrency } from '@/lib/utils/formatters';

const cards = [
  {
    key: 'leadsThisWeek',
    label: 'Leads This Week',
    icon: 'solar:users-group-two-rounded-bold',
    iconBg: 'bg-cyan',
    gradient: 'bg-gradient-start-1',
    format: (v) => v.toLocaleString(),
    deltaKey: 'leadsDelta',
    deltaLabel: 'vs last week',
  },
  {
    key: 'pipelineValue',
    label: 'Pipeline Value',
    icon: 'solar:chart-2-bold',
    iconBg: 'bg-purple',
    gradient: 'bg-gradient-start-2',
    format: (v) => formatCurrency(v),
    deltaKey: null,
    deltaLabel: 'stages 5–7',
  },
  {
    key: 'activeProjects',
    label: 'Active Projects',
    icon: 'solar:code-bold',
    iconBg: 'bg-info',
    gradient: 'bg-gradient-start-3',
    format: (v) => v.toLocaleString(),
    deltaKey: null,
    deltaLabel: 'in progress',
  },
  {
    key: 'revenueThisMonth',
    label: 'Revenue This Month',
    icon: 'solar:wallet-bold',
    iconBg: 'bg-success-main',
    gradient: 'bg-gradient-start-4',
    format: (v) => formatCurrency(v),
    deltaKey: null,
    deltaLabel: 'payments received',
  },
];

const MetricCards = ({ metrics }) => {
  return (
    <div className="row row-cols-xxl-4 row-cols-lg-2 row-cols-1 gy-4">
      {cards.map((card) => {
        const value = metrics[card.key] ?? 0;
        const delta = card.deltaKey ? metrics[card.deltaKey] : null;

        return (
          <div className="col" key={card.key}>
            <div
              className={`card shadow-none border ${card.gradient} h-100`}
            >
              <div className="card-body p-20">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div>
                    <p className="fw-medium text-primary-light mb-1">
                      {card.label}
                    </p>
                    <h6 className="mb-0">{card.format(value)}</h6>
                  </div>
                  <div
                    className={`w-50-px h-50-px ${card.iconBg} rounded-circle d-flex justify-content-center align-items-center`}
                  >
                    <Icon
                      icon={card.icon}
                      className="text-white text-2xl mb-0"
                    />
                  </div>
                </div>
                <p className="fw-medium text-sm text-primary-light mt-12 mb-0 d-flex align-items-center gap-2">
                  {delta !== null && (
                    <span
                      className={`d-inline-flex align-items-center gap-1 ${
                        delta >= 0 ? 'text-success-main' : 'text-danger-main'
                      }`}
                    >
                      <Icon
                        icon={
                          delta >= 0 ? 'bxs:up-arrow' : 'bxs:down-arrow'
                        }
                        className="text-xs"
                      />
                      {delta >= 0 ? `+${delta}` : delta}
                    </span>
                  )}
                  {card.deltaLabel}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MetricCards;
