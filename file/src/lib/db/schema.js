import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  jsonb,
  date,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const leadSourceEnum = pgEnum('lead_source', [
  'web_form',
  'referral',
  'vapi',
  'cold_outreach',
  'word_of_mouth',
  'other',
]);

export const leadScoreEnum = pgEnum('lead_score', ['high', 'medium', 'low']);

export const pipelineStageEnum = pgEnum('pipeline_stage', [
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
]);

export const projectStatusEnum = pgEnum('project_status', [
  'draft',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
]);

export const milestoneStatusEnum = pgEnum('milestone_status', [
  'pending',
  'in_progress',
  'completed',
  'overdue',
]);

export const proposalStatusEnum = pgEnum('proposal_status', [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'declined',
  'expired',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'sent',
  'viewed',
  'paid',
  'overdue',
  'cancelled',
]);

export const pricingTypeEnum = pgEnum('pricing_type', [
  'fixed',
  'phased',
  'hourly',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'square_invoice',
  'square_checkout',
  'manual',
  'other',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'sms',
  'in_app',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'lead_new',
  'lead_stage_change',
  'proposal_accepted',
  'payment_received',
  'client_question',
  'milestone_overdue',
  'lead_stale',
  'demo_shared',
  'milestone_completed',
]);

export const teamRoleEnum = pgEnum('team_role', ['admin', 'member']);

export const questionStatusEnum = pgEnum('question_status', [
  'pending',
  'replied',
]);

// ── Tables ─────────────────────────────────────────────────────────────────────

export const teamUsers = pgTable('team_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: teamRoleEnum('role').notNull().default('member'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  company: text('company'),
  phone: text('phone'),
  notes: text('notes'),
  authUserId: uuid('auth_user_id'),
  createdBy: uuid('created_by').references(() => teamUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Existing table — schema must match current DB exactly
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  companyName: text('company_name'),
  projectType: text('project_type'),
  projectTimeline: text('project_timeline'),
  existingSystems: text('existing_systems'),
  referralSource: text('referral_source'),
  preferredContact: text('preferred_contact').notNull().default('email'),
  projectDetails: text('project_details'),
  smsConsent: boolean('sms_consent').notNull().default(false),
  smsConsentTimestamp: timestamp('sms_consent_timestamp', { withTimezone: true }),
  smsConsentIp: text('sms_consent_ip'),
  smsOptedOut: boolean('sms_opted_out').notNull().default(false),
  source: leadSourceEnum('source').notNull().default('web_form'),
  score: leadScoreEnum('score'),
  pipelineStage: pipelineStageEnum('pipeline_stage').notNull().default('new_lead'),
  pipelineStageChangedAt: timestamp('pipeline_stage_changed_at', { withTimezone: true }).notNull().defaultNow(),
  aiInternalAnalysis: jsonb('ai_internal_analysis'),
  aiProspectSummary: text('ai_prospect_summary'),
  referredBy: uuid('referred_by').references(() => referrers.id),
  referralEmailSent: boolean('referral_email_sent').notNull().default(false),
  referralEmailSentAt: timestamp('referral_email_sent_at', { withTimezone: true }),
  convertedToClientId: uuid('converted_to_client_id').references(() => clients.id),
  assignedTo: uuid('assigned_to').references(() => teamUsers.id),
  notes: text('notes'),
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Existing table — schema must match current DB exactly
export const referrers = pgTable('referrers', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  company: text('company'),
  feedback: text('feedback'),
  aiFeedbackAnalysis: jsonb('ai_feedback_analysis'),
  totalReferrals: integer('total_referrals').notNull().default(0),
  fromParam: text('from_param'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id),
  clientId: uuid('client_id').references(() => clients.id),
  type: text('type').notNull(),
  subject: text('subject'),
  body: text('body'),
  direction: text('direction').notNull().default('outbound'),
  createdBy: uuid('created_by').references(() => teamUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const proposals = pgTable('proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id),
  clientId: uuid('client_id').references(() => clients.id),
  projectId: uuid('project_id'),
  title: text('title').notNull(),
  scopeOfWork: text('scope_of_work').notNull(),
  deliverables: text('deliverables').notNull(),
  termsAndConditions: text('terms_and_conditions').notNull(),
  pricingType: pricingTypeEnum('pricing_type').notNull().default('fixed'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  status: proposalStatusEnum('status').notNull().default('draft'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  declinedAt: timestamp('declined_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  viewedCount: integer('viewed_count').notNull().default(0),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  signerName: text('signer_name'),
  signerIp: text('signer_ip'),
  signedPdfUrl: text('signed_pdf_url'),
  clientSignature: text('client_signature'),
  aiGenerated: boolean('ai_generated').notNull().default(false),
  aiPromptContext: text('ai_prompt_context'),
  createdBy: uuid('created_by').notNull().references(() => teamUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const proposalLineItems = pgTable('proposal_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposalId: uuid('proposal_id').notNull().references(() => proposals.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull().default('0'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull().default('0'),
  sortOrder: integer('sort_order').notNull().default(0),
  phaseLabel: text('phase_label'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  proposalId: uuid('proposal_id').references(() => proposals.id),
  leadId: uuid('lead_id').references(() => leads.id),
  projectType: text('project_type'),
  description: text('description'),
  status: projectStatusEnum('status').notNull().default('draft'),
  pricingType: pricingTypeEnum('pricing_type').notNull().default('fixed'),
  totalValue: decimal('total_value', { precision: 10, scale: 2 }).notNull().default('0'),
  startDate: date('start_date'),
  targetEndDate: date('target_end_date'),
  actualEndDate: date('actual_end_date'),
  createdBy: uuid('created_by').notNull().references(() => teamUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectPhases = pgTable('project_phases', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectMilestones = pgTable('project_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  phaseId: uuid('phase_id').notNull().references(() => projectPhases.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: milestoneStatusEnum('status').notNull().default('pending'),
  sortOrder: integer('sort_order').notNull().default(0),
  dueDate: date('due_date'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  triggersInvoice: boolean('triggers_invoice').notNull().default(false),
  invoiceAmount: decimal('invoice_amount', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectRepos = pgTable('project_repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  githubOwner: text('github_owner').notNull(),
  githubRepo: text('github_repo').notNull(),
  githubUrl: text('github_url').notNull(),
  defaultBranch: text('default_branch').notNull().default('main'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectDemos = pgTable('project_demos', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description'),
  phaseId: uuid('phase_id').references(() => projectPhases.id),
  isAutoPulled: boolean('is_auto_pulled').notNull().default(false),
  isApproved: boolean('is_approved').notNull().default(false),
  createdBy: uuid('created_by').references(() => teamUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectQuestions = pgTable('project_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  questionText: text('question_text').notNull(),
  status: questionStatusEnum('status').notNull().default('pending'),
  replyDraft: text('reply_draft'),
  replyText: text('reply_text'),
  repliedBy: uuid('replied_by').references(() => teamUsers.id),
  repliedAt: timestamp('replied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  projectId: uuid('project_id').references(() => projects.id),
  milestoneId: uuid('milestone_id').references(() => projectMilestones.id),
  squareInvoiceId: text('square_invoice_id'),
  squarePaymentUrl: text('square_payment_url'),
  title: text('title').notNull(),
  description: text('description'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull().default('0'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  dueDate: date('due_date'),
  createdBy: uuid('created_by').notNull().references(() => teamUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull().default('0'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull().default('0'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  squarePaymentId: text('square_payment_id'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull().default('0'),
  method: paymentMethodEnum('method').notNull().default('square_invoice'),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: notificationTypeEnum('type').notNull(),
  channel: notificationChannelEnum('channel').notNull().default('email'),
  recipientEmail: text('recipient_email').notNull(),
  recipientPhone: text('recipient_phone'),
  subject: text('subject'),
  body: text('body').notNull(),
  relatedLeadId: uuid('related_lead_id').references(() => leads.id),
  relatedProjectId: uuid('related_project_id').references(() => projects.id),
  relatedInvoiceId: uuid('related_invoice_id').references(() => invoices.id),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),
  actorType: text('actor_type').notNull().default('team'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emailDrafts = pgTable('email_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientEmail: text('recipient_email').notNull(),
  recipientName: text('recipient_name'),
  recipientLeadId: uuid('recipient_lead_id').references(() => leads.id),
  recipientClientId: uuid('recipient_client_id').references(() => clients.id),
  subject: text('subject'),
  bodyHtml: text('body_html'),
  bodyText: text('body_text'),
  category: text('category'),
  tone: text('tone'),
  customInstructions: text('custom_instructions'),
  status: text('status').notNull().default('draft'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => teamUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const inAppNotifications = pgTable('in_app_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => teamUsers.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => teamUsers.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ──────────────────────────────────────────────────────────────────

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignedTeamUser: one(teamUsers, {
    fields: [leads.assignedTo],
    references: [teamUsers.id],
  }),
  convertedClient: one(clients, {
    fields: [leads.convertedToClientId],
    references: [clients.id],
  }),
  referrer: one(referrers, {
    fields: [leads.referredBy],
    references: [referrers.id],
  }),
  contacts: many(contacts),
  proposals: many(proposals),
  projects: many(projects),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  createdByUser: one(teamUsers, {
    fields: [clients.createdBy],
    references: [teamUsers.id],
  }),
  projects: many(projects),
  proposals: many(proposals),
  invoices: many(invoices),
  contacts: many(contacts),
  questions: many(projectQuestions),
}));

export const referrersRelations = relations(referrers, ({ many }) => ({
  leads: many(leads),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  lead: one(leads, {
    fields: [contacts.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [contacts.clientId],
    references: [clients.id],
  }),
  createdByUser: one(teamUsers, {
    fields: [contacts.createdBy],
    references: [teamUsers.id],
  }),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  lead: one(leads, {
    fields: [proposals.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [proposals.clientId],
    references: [clients.id],
  }),
  createdByUser: one(teamUsers, {
    fields: [proposals.createdBy],
    references: [teamUsers.id],
  }),
  lineItems: many(proposalLineItems),
}));

export const proposalLineItemsRelations = relations(proposalLineItems, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalLineItems.proposalId],
    references: [proposals.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  proposal: one(proposals, {
    fields: [projects.proposalId],
    references: [proposals.id],
  }),
  lead: one(leads, {
    fields: [projects.leadId],
    references: [leads.id],
  }),
  createdByUser: one(teamUsers, {
    fields: [projects.createdBy],
    references: [teamUsers.id],
  }),
  phases: many(projectPhases),
  milestones: many(projectMilestones),
  repos: many(projectRepos),
  demos: many(projectDemos),
  questions: many(projectQuestions),
  invoices: many(invoices),
}));

export const projectPhasesRelations = relations(projectPhases, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectPhases.projectId],
    references: [projects.id],
  }),
  milestones: many(projectMilestones),
  demos: many(projectDemos),
}));

export const projectMilestonesRelations = relations(projectMilestones, ({ one }) => ({
  project: one(projects, {
    fields: [projectMilestones.projectId],
    references: [projects.id],
  }),
  phase: one(projectPhases, {
    fields: [projectMilestones.phaseId],
    references: [projectPhases.id],
  }),
}));

export const projectReposRelations = relations(projectRepos, ({ one }) => ({
  project: one(projects, {
    fields: [projectRepos.projectId],
    references: [projects.id],
  }),
}));

export const projectDemosRelations = relations(projectDemos, ({ one }) => ({
  project: one(projects, {
    fields: [projectDemos.projectId],
    references: [projects.id],
  }),
  phase: one(projectPhases, {
    fields: [projectDemos.phaseId],
    references: [projectPhases.id],
  }),
  createdByUser: one(teamUsers, {
    fields: [projectDemos.createdBy],
    references: [teamUsers.id],
  }),
}));

export const projectQuestionsRelations = relations(projectQuestions, ({ one }) => ({
  project: one(projects, {
    fields: [projectQuestions.projectId],
    references: [projects.id],
  }),
  client: one(clients, {
    fields: [projectQuestions.clientId],
    references: [clients.id],
  }),
  repliedByUser: one(teamUsers, {
    fields: [projectQuestions.repliedBy],
    references: [teamUsers.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id],
  }),
  milestone: one(projectMilestones, {
    fields: [invoices.milestoneId],
    references: [projectMilestones.id],
  }),
  createdByUser: one(teamUsers, {
    fields: [invoices.createdBy],
    references: [teamUsers.id],
  }),
  lineItems: many(invoiceLineItems),
  payments: many(payments),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  client: one(clients, {
    fields: [payments.clientId],
    references: [clients.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  lead: one(leads, {
    fields: [notifications.relatedLeadId],
    references: [leads.id],
  }),
  project: one(projects, {
    fields: [notifications.relatedProjectId],
    references: [projects.id],
  }),
  invoice: one(invoices, {
    fields: [notifications.relatedInvoiceId],
    references: [invoices.id],
  }),
}));

export const inAppNotificationsRelations = relations(inAppNotifications, ({ one }) => ({
  user: one(teamUsers, {
    fields: [inAppNotifications.userId],
    references: [teamUsers.id],
  }),
}));

export const emailDraftsRelations = relations(emailDrafts, ({ one }) => ({
  lead: one(leads, {
    fields: [emailDrafts.recipientLeadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [emailDrafts.recipientClientId],
    references: [clients.id],
  }),
  createdByUser: one(teamUsers, {
    fields: [emailDrafts.createdBy],
    references: [teamUsers.id],
  }),
}));
