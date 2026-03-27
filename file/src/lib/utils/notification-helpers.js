export const NOTIFICATION_ICONS = {
  pipeline_move: 'mdi:swap-horizontal-circle-outline',
  proposal_viewed: 'mdi:eye-outline',
  proposal_signed: 'mdi:check-decagram-outline',
  proposal_created: 'mdi:file-document-plus-outline',
  proposal_sent: 'mdi:send-outline',
  lead_assigned: 'mdi:account-arrow-right-outline',
  lead_stale: 'mdi:clock-alert-outline',
  lead_stage_change: 'mdi:swap-horizontal-circle-outline',
  milestone_completed: 'mdi:flag-checkered',
  milestone_overdue: 'mdi:flag-remove-outline',
  project_created: 'mdi:folder-plus-outline',
  project_completed: 'mdi:folder-check-outline',
  demo_approved: 'mdi:monitor-share',
  demo_shared: 'mdi:monitor-share',
  client_question: 'mdi:chat-question-outline',
  client_created: 'mdi:account-plus-outline',
  follow_up_reminder: 'mdi:bell-ring-outline',
  new_lead: 'mdi:account-star-outline',
  meeting_booked: 'mdi:calendar-check-outline',
  meeting_created: 'mdi:calendar-plus-outline',
  meeting_rescheduled: 'mdi:calendar-refresh-outline',
  meeting_cancelled: 'mdi:calendar-remove-outline',
  meeting_reminder: 'mdi:calendar-clock-outline',
  meeting_completed: 'mdi:calendar-check',
  payment_received: 'mdi:cash-check',
  invoice_created: 'mdi:receipt-text-plus-outline',
  invoice_sent: 'mdi:receipt-text-send-outline',
};

export const NOTIFICATION_COLORS = {
  pipeline_move: '#0dcaf0',
  proposal_viewed: '#0d6efd',
  proposal_signed: '#198754',
  proposal_created: '#0d6efd',
  proposal_sent: '#0d6efd',
  lead_assigned: '#6f42c1',
  lead_stale: '#ffc107',
  lead_stage_change: '#0dcaf0',
  milestone_completed: '#03FF00',
  milestone_overdue: '#dc3545',
  project_created: '#03FF00',
  project_completed: '#03FF00',
  demo_approved: '#fd7e14',
  demo_shared: '#fd7e14',
  client_question: '#ffc107',
  client_created: '#198754',
  follow_up_reminder: '#dc3545',
  new_lead: '#03FF00',
  meeting_booked: '#0dcaf0',
  meeting_created: '#0dcaf0',
  meeting_rescheduled: '#ffc107',
  meeting_cancelled: '#dc3545',
  meeting_reminder: '#ffc107',
  meeting_completed: '#198754',
  payment_received: '#198754',
  invoice_created: '#0d6efd',
  invoice_sent: '#0d6efd',
};

/**
 * Category grouping for notification types.
 */
export const NOTIFICATION_CATEGORIES = {
  'Lead Activity': ['new_lead', 'lead_assigned', 'lead_stage_change', 'lead_stale', 'pipeline_move'],
  'Projects & Milestones': ['project_created', 'project_completed', 'milestone_completed', 'milestone_overdue', 'demo_approved', 'demo_shared'],
  'Proposals': ['proposal_created', 'proposal_sent', 'proposal_viewed', 'proposal_signed'],
  'Invoices & Payments': ['invoice_created', 'invoice_sent', 'payment_received'],
  'Meetings': ['meeting_booked', 'meeting_created', 'meeting_rescheduled', 'meeting_cancelled', 'meeting_reminder', 'meeting_completed'],
  'Client Portal': ['client_created', 'client_question', 'follow_up_reminder'],
};

/**
 * Human-readable label for a notification type.
 */
export function typeLabel(type) {
  return (type || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Relative time string.
 */
export function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
