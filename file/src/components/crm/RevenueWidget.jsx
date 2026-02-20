import { Icon } from '@iconify/react';

const formatCurrency = (val) => {
  if (val >= 1000) {
    return `$${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  }
  return `$${val.toFixed(0)}`;
};

const RevenueWidget = ({ revenue }) => {
  const { invoicedThisMonth, paidThisMonth, outstanding, momChange } = revenue;

  const metrics = [
    {
      label: 'Invoiced This Month',
      value: formatCurrency(invoicedThisMonth),
      icon: 'mdi:file-document-outline',
      color: '#0dcaf0',
    },
    {
      label: 'Collected This Month',
      value: formatCurrency(paidThisMonth),
      icon: 'mdi:cash-check',
      color: '#198754',
    },
    {
      label: 'Outstanding',
      value: formatCurrency(outstanding),
      icon: 'mdi:clock-outline',
      color: outstanding > 0 ? '#ffc107' : '#6c757d',
    },
  ];

  return (
    <div className="card h-100">
      <div className="card-header border-bottom d-flex align-items-center justify-content-between">
        <h6 className="text-lg fw-semibold mb-0">Revenue</h6>
        {momChange !== 0 && (
          <span
            className="badge d-flex align-items-center gap-1"
            style={{
              background: momChange > 0 ? 'rgba(25,135,84,0.15)' : 'rgba(220,53,69,0.15)',
              color: momChange > 0 ? '#198754' : '#dc3545',
            }}
          >
            <Icon
              icon={momChange > 0 ? 'mdi:trending-up' : 'mdi:trending-down'}
              style={{ fontSize: '14px' }}
            />
            {momChange > 0 ? '+' : ''}{momChange}% MoM
          </span>
        )}
      </div>
      <div className="card-body">
        <div className="row g-3">
          {metrics.map((m) => (
            <div key={m.label} className="col-sm-4">
              <div
                className="rounded-3 p-3 text-center"
                style={{ background: `${m.color}11` }}
              >
                <Icon
                  icon={m.icon}
                  className="mb-2"
                  style={{ fontSize: '24px', color: m.color }}
                />
                <h5 className="text-white fw-bold mb-1">{m.value}</h5>
                <span className="text-secondary-light text-xs">{m.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RevenueWidget;
