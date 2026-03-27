'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const STAGE_ORDER = [
  'new_lead',
  'contacted',
  'discovery_scheduled',
  'discovery_completed',
  'proposal_sent',
  'negotiation',
  'contract_signed',
  'active_client',
  'project_delivered',
  'retention',
];

const STAGE_LABELS = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  discovery_scheduled: 'Discovery Sched.',
  discovery_completed: 'Discovery Done',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  contract_signed: 'Contract Signed',
  active_client: 'Active Client',
  project_delivered: 'Delivered',
  retention: 'Retention',
};

const LeadFunnelChart = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/lead-funnel')
      .then((r) => r.json())
      .then((d) => {
        setData(d.stages || []);
        setLoading(false);
      })
      .catch(() => {
        setData([]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ height: 280 }}>
        <span className="spinner-border spinner-border-sm text-secondary-light" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center" style={{ height: 280 }}>
        <span className="text-secondary-light text-sm">No leads in pipeline</span>
      </div>
    );
  }

  // Map data to ordered stages
  const stageMap = {};
  data.forEach((d) => {
    stageMap[d.stage] = Number(d.count);
  });

  const categories = STAGE_ORDER.map((s) => STAGE_LABELS[s] || s);
  const counts = STAGE_ORDER.map((s) => stageMap[s] || 0);

  const options = {
    chart: {
      type: 'bar',
      height: 280,
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'Inter Tight, sans-serif',
    },
    plotOptions: {
      bar: { horizontal: true, borderRadius: 4, barHeight: '60%' },
    },
    colors: ['#03FF00'],
    dataLabels: {
      enabled: true,
      style: { fontSize: '11px', colors: ['#fff'] },
      offsetX: 4,
    },
    xaxis: {
      categories,
      labels: { style: { colors: '#6c757d', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: '#adb5bd', fontSize: '11px' } },
    },
    grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val) => val + ' lead' + (val !== 1 ? 's' : '') },
    },
  };

  const series = [{ name: 'Leads', data: counts }];

  return <Chart options={options} series={series} type="bar" height={280} />;
};

export default LeadFunnelChart;
