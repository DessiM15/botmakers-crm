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
  { value: 'tiktok', label: 'TikTok' },
  { value: 'social_media', label: 'Social Media' },
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

export const SERVICE_TYPES = [
  { value: 'all', label: 'All Services' },
  { value: 'internal', label: 'Internal (BotMakers)' },
  { value: 'client', label: 'Client Services' },
];

export const SERVICE_CATEGORIES = [
  { value: 'hosting', label: 'Hosting', icon: 'mdi:server' },
  { value: 'domain', label: 'Domain', icon: 'mdi:web' },
  { value: 'api', label: 'API / SaaS', icon: 'mdi:api' },
  { value: 'analytics', label: 'Analytics', icon: 'mdi:chart-line' },
  { value: 'email', label: 'Email', icon: 'mdi:email-outline' },
  { value: 'storage', label: 'Storage', icon: 'mdi:cloud-outline' },
  { value: 'other', label: 'Other', icon: 'mdi:dots-horizontal-circle-outline' },
];

export const BILLING_CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one_time', label: 'One-Time' },
];

export const SERVICE_STATUSES = [
  { value: 'active', label: 'Active', color: '#198754' },
  { value: 'expiring_soon', label: 'Expiring Soon', color: '#ffc107' },
  { value: 'expired', label: 'Expired', color: '#dc3545' },
  { value: 'cancelled', label: 'Cancelled', color: '#6c757d' },
];

export const DOCUMENT_CATEGORIES = [
  { value: 'contract', label: 'Contract', icon: 'mdi:file-sign' },
  { value: 'design', label: 'Design', icon: 'mdi:palette-outline' },
  { value: 'brief', label: 'Brief', icon: 'mdi:text-box-outline' },
  { value: 'credentials', label: 'Credentials', icon: 'mdi:key-outline' },
  { value: 'deliverable', label: 'Deliverable', icon: 'mdi:package-variant-closed' },
  { value: 'other', label: 'Other', icon: 'mdi:file-outline' },
];

export const EDITABLE_DOC_CATEGORIES = [
  { value: 'spec', label: 'Spec / Technical', icon: 'mdi:file-code-outline' },
  { value: 'meeting_notes', label: 'Meeting Notes', icon: 'mdi:notebook-outline' },
  { value: 'sop', label: 'SOP / Runbook', icon: 'mdi:clipboard-text-outline' },
  { value: 'internal', label: 'Internal Notes', icon: 'mdi:note-text-outline' },
  { value: 'other', label: 'Other', icon: 'mdi:file-document-outline' },
];

export const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/markdown', 'text/x-markdown', 'text/html',
  'application/json', 'application/octet-stream',
  'application/zip', 'application/x-tar', 'application/gzip', 'application/x-zip-compressed',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav',
];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const COST_SOURCES = [
  { value: 'manual', label: 'Manual', icon: 'mdi:pencil-outline', color: '#6c757d' },
  { value: 'vercel', label: 'Vercel', icon: 'mdi:triangle-outline', color: '#000' },
  { value: 'anthropic', label: 'Anthropic', icon: 'mdi:robot-outline', color: '#d4a574' },
  { value: 'square_fees', label: 'Square Fees', icon: 'mdi:square-outline', color: '#006aff' },
  { value: 'supabase', label: 'Supabase', icon: 'mdi:database-outline', color: '#3ecf8e' },
  { value: 'github', label: 'GitHub', icon: 'mdi:github', color: '#fff' },
  { value: 'resend', label: 'Resend', icon: 'mdi:email-fast-outline', color: '#000' },
  { value: 'upstash', label: 'Upstash', icon: 'mdi:server-outline', color: '#00e9a3' },
  { value: 'other', label: 'Other', icon: 'mdi:dots-horizontal-circle-outline', color: '#6c757d' },
];

export const COST_PROVIDERS = [
  'Vercel',
  'Anthropic',
  'Square',
  'Supabase',
  'GitHub',
  'Resend',
  'Upstash',
  'Google',
  'AWS',
  'Cloudflare',
  'Other',
];

export const CALENDAR_CATEGORIES = [
  { key: 'meeting', label: 'Meetings', icon: 'mdi:calendar-clock-outline' },
  { key: 'calcom', label: 'Cal.com', icon: 'mdi:calendar-check-outline' },
  { key: 'website', label: 'Website Bookings', icon: 'mdi:web' },
  { key: 'milestone', label: 'Milestones', icon: 'mdi:flag-checkered' },
];

export const DEFAULT_CALENDAR_COLORS = {
  meeting: '#0d6efd',
  calcom: '#6f42c1',
  website: '#e85d04',
  milestone: '#03FF00',
  milestone_overdue: '#dc3545',
  cancelled: '#6c757d',
};

export const CALENDAR_PRESET_COLORS = [
  '#0d6efd', '#6f42c1', '#e85d04', '#03FF00',
  '#dc3545', '#ffc107', '#0dcaf0', '#198754',
  '#fd7e14', '#d63384', '#20c997', '#6c757d',
  '#033457', '#1E40AF',
];
