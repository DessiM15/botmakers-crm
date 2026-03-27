'use client';

import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const RevenueChart = ({ monthlyRevenue = [] }) => {
  if (!monthlyRevenue || monthlyRevenue.length === 0) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center" style={{ height: 300 }}>
        <span className="text-secondary-light text-sm">No revenue data yet</span>
      </div>
    );
  }

  const monthLabels = monthlyRevenue.map((m) => m.month);
  const invoicedData = monthlyRevenue.map((m) => m.invoiced);
  const collectedData = monthlyRevenue.map((m) => m.collected);

  const options = {
    chart: {
      type: 'area',
      height: 300,
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'Inter Tight, sans-serif',
    },
    colors: ['#0d6efd', '#03FF00'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 },
    },
    xaxis: {
      categories: monthLabels,
      labels: { style: { colors: '#6c757d', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: (val) => '$' + (val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val),
        style: { colors: '#6c757d', fontSize: '11px' },
      },
    },
    grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: { colors: '#adb5bd' },
      fontSize: '12px',
    },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val) => '$' + val.toLocaleString() },
    },
  };

  const series = [
    { name: 'Invoiced', data: invoicedData },
    { name: 'Collected', data: collectedData },
  ];

  return <Chart options={options} series={series} type="area" height={300} />;
};

export default RevenueChart;
