export const PIPELINE_STAGES = [
  { value: 'new_lead', label: 'New Lead', color: '#6c757d' },
  { value: 'contacted', label: 'Contacted', color: '#0dcaf0' },
  { value: 'discovery_scheduled', label: 'Discovery Scheduled', color: '#0d6efd' },
  { value: 'discovery_completed', label: 'Discovery Completed', color: '#6610f2' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: '#6f42c1' },
  { value: 'negotiation', label: 'Negotiation', color: '#fd7e14' },
  { value: 'contract_signed', label: 'Contract Signed', color: '#ffc107' },
  { value: 'active_client', label: 'Active Client', color: '#198754' },
  { value: 'project_delivered', label: 'Project Delivered', color: '#03FF00' },
  { value: 'retention', label: 'Retention', color: '#033457' },
];

export const DEFAULT_PROJECT_PHASES = [
  {
    name: 'Discovery',
    sortOrder: 1,
    milestones: [
      'Initial consultation',
      'Requirements documented',
      'Project plan approved',
    ],
  },
  {
    name: 'MVP Build',
    sortOrder: 2,
    milestones: [
      'Dev environment setup',
      'Core features implemented',
      'Internal testing passed',
    ],
  },
  {
    name: 'Revision',
    sortOrder: 3,
    milestones: [
      'Client feedback collected',
      'Revisions implemented',
      'Final testing passed',
    ],
  },
  {
    name: 'Launch',
    sortOrder: 4,
    milestones: [
      'Deployment completed',
      'Client training done',
      'Project handoff complete',
    ],
  },
];

export const LEAD_SOURCES = [
  { value: 'web_form', label: 'Web Form' },
  { value: 'referral', label: 'Referral' },
  { value: 'vapi', label: 'Vapi' },
  { value: 'cold_outreach', label: 'Cold Outreach' },
  { value: 'word_of_mouth', label: 'Word of Mouth' },
  { value: 'other', label: 'Other' },
];

export const LEAD_SCORES = [
  { value: 'high', label: 'High', color: '#198754' },
  { value: 'medium', label: 'Medium', color: '#ffc107' },
  { value: 'low', label: 'Low', color: '#dc3545' },
];

export const PROJECT_STATUSES = [
  { value: 'draft', label: 'Draft', color: '#6c757d' },
  { value: 'in_progress', label: 'In Progress', color: '#0d6efd' },
  { value: 'paused', label: 'Paused', color: '#ffc107' },
  { value: 'completed', label: 'Completed', color: '#198754' },
  { value: 'cancelled', label: 'Cancelled', color: '#dc3545' },
];

export const PROPOSAL_STATUSES = [
  { value: 'draft', label: 'Draft', color: '#6c757d' },
  { value: 'sent', label: 'Sent', color: '#0dcaf0' },
  { value: 'viewed', label: 'Viewed', color: '#0d6efd' },
  { value: 'accepted', label: 'Accepted', color: '#198754' },
  { value: 'declined', label: 'Declined', color: '#dc3545' },
  { value: 'expired', label: 'Expired', color: '#6c757d' },
];

export const INVOICE_STATUSES = [
  { value: 'draft', label: 'Draft', color: '#6c757d' },
  { value: 'sent', label: 'Sent', color: '#0dcaf0' },
  { value: 'viewed', label: 'Viewed', color: '#0d6efd' },
  { value: 'paid', label: 'Paid', color: '#198754' },
  { value: 'overdue', label: 'Overdue', color: '#dc3545' },
  { value: 'cancelled', label: 'Cancelled', color: '#6c757d' },
];
