# Data Model

> Database: Supabase PostgreSQL at `nqfgafvrxoqpnsakbtgw.supabase.co`
> ORM: Drizzle ORM
> Schema: `file/src/lib/db/schema.js`

## Connection

- **Transaction Pooler:** `aws-1-us-east-1.pooler.supabase.com:6543` (required — direct connection is IPv6-only, fails on Vercel and local)
- All primary keys are UUIDs
- All timestamps are TIMESTAMPTZ
- All currency fields use DECIMAL(10,2)

---

## Enumerations (11)

| Enum | Values |
|------|--------|
| `lead_source` | `web_form`, `referral`, `vapi`, `cold_outreach`, `word_of_mouth`, `other` |
| `lead_score` | `high`, `medium`, `low` |
| `pipeline_stage` | `new_lead`, `contacted`, `discovery_scheduled`, `discovery_completed`, `proposal_sent`, `negotiation`, `contract_signed`, `active_client`, `project_delivered`, `retention` |
| `project_status` | `draft`, `in_progress`, `paused`, `completed`, `cancelled` |
| `milestone_status` | `pending`, `in_progress`, `completed`, `overdue` |
| `proposal_status` | `draft`, `sent`, `viewed`, `accepted`, `declined`, `expired` |
| `invoice_status` | `draft`, `sent`, `viewed`, `paid`, `overdue`, `cancelled` |
| `pricing_type` | `fixed`, `phased`, `hourly` |
| `payment_method` | `square_invoice`, `square_checkout`, `manual`, `other` |
| `notification_channel` | `email`, `sms`, `in_app` |
| `notification_type` | `lead_new`, `lead_stage_change`, `proposal_accepted`, `payment_received`, `client_question`, `milestone_overdue`, `lead_stale`, `demo_shared`, `milestone_completed` |

Additional enums in schema (not separate DB enum types):
- `team_role`: `admin`, `member`
- `question_status`: `pending`, `replied`

---

## Tables (22)

### 1. team_users

Team members who access the CRM.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | random() | PK |
| email | TEXT | NO | - | UNIQUE |
| full_name | TEXT | NO | - | |
| role | team_role | NO | `'member'` | admin or member |
| avatar_url | TEXT | YES | - | |
| is_active | BOOLEAN | NO | true | Soft deactivation |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

Referenced by: leads, clients, contacts, proposals, projects, project_demos, project_questions, invoices, notifications, activity_log, email_drafts, in_app_notifications, follow_up_reminders, system_settings

---

### 2. clients

Companies/individuals who are active clients.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | random() | PK |
| email | TEXT | NO | - | UNIQUE |
| full_name | TEXT | NO | - | |
| company | TEXT | YES | - | |
| phone | TEXT | YES | - | |
| notes | TEXT | YES | - | Internal notes |
| auth_user_id | UUID | YES | - | Supabase Auth user ID |
| portal_invited_at | TIMESTAMPTZ | YES | - | When portal invite sent |
| portal_invite_count | INTEGER | NO | 0 | Total invites sent |
| portal_last_login_at | TIMESTAMPTZ | YES | - | Last portal login |
| portal_first_login_at | TIMESTAMPTZ | YES | - | First portal login |
| portal_onboarding_complete | BOOLEAN | NO | false | Completed walkthrough |
| portal_access_revoked | BOOLEAN | NO | false | Access disabled |
| created_by | UUID | YES | - | FK team_users.id |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

---

### 3. leads (existing table)

Leads from the live website intake form. **Cannot drop or rename existing columns.**

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | random() | PK |
| full_name | TEXT | NO | - | |
| email | TEXT | NO | - | |
| phone | TEXT | YES | - | |
| company_name | TEXT | YES | - | |
| project_type | TEXT | YES | - | |
| project_timeline | TEXT | YES | - | |
| existing_systems | TEXT | YES | - | |
| referral_source | TEXT | YES | - | Original referral source |
| preferred_contact | TEXT | NO | `'email'` | |
| project_details | TEXT | YES | - | |
| sms_consent | BOOLEAN | NO | false | |
| sms_consent_timestamp | TIMESTAMPTZ | YES | - | |
| sms_consent_ip | TEXT | YES | - | |
| sms_opted_out | BOOLEAN | NO | false | |
| source | lead_source | NO | `'web_form'` | CRM field |
| score | lead_score | YES | - | CRM field |
| pipeline_stage | pipeline_stage | NO | `'new_lead'` | CRM field |
| pipeline_stage_changed_at | TIMESTAMPTZ | NO | now() | CRM field |
| ai_internal_analysis | JSONB | YES | - | Claude analysis |
| ai_prospect_summary | TEXT | YES | - | Claude summary |
| referred_by | UUID | YES | - | FK referrers.id |
| referral_email_sent | BOOLEAN | NO | false | |
| referral_email_sent_at | TIMESTAMPTZ | YES | - | |
| converted_to_client_id | UUID | YES | - | FK clients.id |
| assigned_to | UUID | YES | - | FK team_users.id |
| notes | TEXT | YES | - | |
| last_contacted_at | TIMESTAMPTZ | YES | - | |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

---

### 4. referrers (existing table)

Referral partners who send leads. **Cannot drop or rename existing columns.**

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | random() | PK |
| slug | TEXT | NO | - | URL slug |
| full_name | TEXT | NO | - | |
| email | TEXT | NO | - | |
| company | TEXT | YES | - | |
| feedback | TEXT | YES | - | |
| ai_feedback_analysis | JSONB | YES | - | |
| total_referrals | INTEGER | NO | 0 | |
| from_param | TEXT | YES | - | URL parameter |
| ip_address | TEXT | YES | - | |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

---

### 5. contacts

Interaction log for leads and clients.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | random() | PK |
| lead_id | UUID | YES | - | FK leads.id |
| client_id | UUID | YES | - | FK clients.id |
| type | TEXT | NO | - | email, call, meeting, sms, note |
| subject | TEXT | YES | - | |
| body | TEXT | YES | - | |
| direction | TEXT | NO | `'outbound'` | inbound or outbound |
| created_by | UUID | YES | - | FK team_users.id |
| created_at | TIMESTAMPTZ | NO | now() | |

---

### 6. proposals

Sales proposals sent to leads/clients.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | random() | PK |
| lead_id | UUID | YES | - | FK leads.id |
| client_id | UUID | YES | - | FK clients.id |
| project_id | UUID | YES | - | FK projects.id |
| title | TEXT | NO | - | |
| scope_of_work | TEXT | NO | - | HTML content |
| deliverables | TEXT | NO | - | HTML content |
| terms_and_conditions | TEXT | NO | - | HTML content |
| pricing_type | pricing_type | NO | `'fixed'` | |
| total_amount | DECIMAL(10,2) | NO | 0 | |
| status | proposal_status | NO | `'draft'` | |
| sent_at | TIMESTAMPTZ | YES | - | |
| viewed_at | TIMESTAMPTZ | YES | - | |
| accepted_at | TIMESTAMPTZ | YES | - | |
| declined_at | TIMESTAMPTZ | YES | - | |
| expires_at | TIMESTAMPTZ | YES | - | |
| viewed_count | INTEGER | NO | 0 | |
| signed_at | TIMESTAMPTZ | YES | - | |
| signer_name | TEXT | YES | - | |
| signer_ip | TEXT | YES | - | |
| signed_pdf_url | TEXT | YES | - | |
| client_signature | TEXT | YES | - | |
| ai_generated | BOOLEAN | NO | false | |
| ai_prompt_context | TEXT | YES | - | |
| created_by | UUID | NO | - | FK team_users.id |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

---

### 7. proposal_line_items

Line items on proposals. CASCADE delete with parent.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| proposal_id | UUID | NO | FK proposals.id (CASCADE) |
| description | TEXT | NO | - |
| quantity | DECIMAL(10,2) | NO | 1 |
| unit_price | DECIMAL(10,2) | NO | 0 |
| total | DECIMAL(10,2) | NO | 0 |
| sort_order | INTEGER | NO | 0 |
| phase_label | TEXT | YES | - |
| created_at | TIMESTAMPTZ | NO | now() |

---

### 8. projects

Client projects with phases and milestones.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | random() | PK |
| name | TEXT | NO | - | |
| client_id | UUID | NO | - | FK clients.id |
| proposal_id | UUID | YES | - | FK proposals.id |
| lead_id | UUID | YES | - | FK leads.id |
| project_type | TEXT | YES | - | |
| description | TEXT | YES | - | |
| status | project_status | NO | `'draft'` | |
| pricing_type | pricing_type | NO | `'fixed'` | |
| total_value | DECIMAL(10,2) | NO | 0 | |
| start_date | DATE | YES | - | |
| target_end_date | DATE | YES | - | |
| actual_end_date | DATE | YES | - | |
| created_by | UUID | NO | - | FK team_users.id |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

---

### 9. project_phases

Phases within a project. CASCADE delete with parent.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| project_id | UUID | NO | FK projects.id (CASCADE) |
| name | TEXT | NO | - |
| sort_order | INTEGER | NO | 0 |
| created_at | TIMESTAMPTZ | NO | now() |

---

### 10. project_milestones

Milestones within project phases. CASCADE delete with parent.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | random() | PK |
| project_id | UUID | NO | FK projects.id (CASCADE) | |
| phase_id | UUID | NO | FK project_phases.id (CASCADE) | |
| title | TEXT | NO | - | |
| description | TEXT | YES | - | |
| status | milestone_status | NO | `'pending'` | |
| sort_order | INTEGER | NO | 0 | |
| due_date | DATE | YES | - | |
| completed_at | TIMESTAMPTZ | YES | - | |
| triggers_invoice | BOOLEAN | NO | false | Auto-create invoice on completion |
| invoice_amount | DECIMAL(10,2) | YES | - | Amount for auto-invoice |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

---

### 11. project_repos

GitHub repositories linked to projects. CASCADE delete.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| project_id | UUID | NO | FK projects.id (CASCADE) |
| github_owner | TEXT | NO | - |
| github_repo | TEXT | NO | - |
| github_url | TEXT | NO | - |
| default_branch | TEXT | NO | `'main'` |
| last_synced_at | TIMESTAMPTZ | YES | - |
| created_at | TIMESTAMPTZ | NO | now() |

---

### 12. project_demos

Demo deployments linked to projects. CASCADE delete.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| project_id | UUID | NO | FK projects.id (CASCADE) |
| title | TEXT | NO | - |
| url | TEXT | NO | - |
| description | TEXT | YES | - |
| phase_id | UUID | YES | FK project_phases.id |
| is_auto_pulled | BOOLEAN | NO | false |
| is_approved | BOOLEAN | NO | false |
| created_by | UUID | YES | FK team_users.id |
| created_at | TIMESTAMPTZ | NO | now() |

---

### 13. project_questions

Client questions submitted via portal.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| project_id | UUID | NO | FK projects.id (CASCADE) |
| client_id | UUID | NO | FK clients.id |
| question_text | TEXT | NO | - |
| status | question_status | NO | `'pending'` |
| reply_draft | TEXT | YES | - |
| reply_text | TEXT | YES | - |
| replied_by | UUID | YES | FK team_users.id |
| replied_at | TIMESTAMPTZ | YES | - |
| created_at | TIMESTAMPTZ | NO | now() |

---

### 14. invoices

Invoices for clients, optionally linked to projects/milestones.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | random() | PK |
| client_id | UUID | NO | - | FK clients.id |
| project_id | UUID | YES | - | FK projects.id |
| milestone_id | UUID | YES | - | FK project_milestones.id |
| square_invoice_id | TEXT | YES | - | Square invoice ID |
| square_payment_url | TEXT | YES | - | Square payment URL |
| title | TEXT | NO | - | |
| description | TEXT | YES | - | |
| amount | DECIMAL(10,2) | NO | 0 | |
| status | invoice_status | NO | `'draft'` | |
| sent_at | TIMESTAMPTZ | YES | - | |
| viewed_at | TIMESTAMPTZ | YES | - | |
| paid_at | TIMESTAMPTZ | YES | - | |
| due_date | DATE | YES | - | |
| created_by | UUID | NO | - | FK team_users.id |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

---

### 15. invoice_line_items

Line items on invoices. CASCADE delete.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| invoice_id | UUID | NO | FK invoices.id (CASCADE) |
| description | TEXT | NO | - |
| quantity | DECIMAL(10,2) | NO | 1 |
| unit_price | DECIMAL(10,2) | NO | 0 |
| total | DECIMAL(10,2) | NO | 0 |
| sort_order | INTEGER | NO | 0 |
| created_at | TIMESTAMPTZ | NO | now() |

---

### 16. payments

Payment records for invoices.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| invoice_id | UUID | NO | FK invoices.id |
| client_id | UUID | NO | FK clients.id |
| square_payment_id | TEXT | YES | - |
| amount | DECIMAL(10,2) | NO | 0 |
| method | payment_method | NO | `'square_invoice'` |
| paid_at | TIMESTAMPTZ | NO | now() |
| created_at | TIMESTAMPTZ | NO | now() |

---

### 17. notifications

Outbound notification log.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| type | notification_type | NO | - |
| channel | notification_channel | NO | `'email'` |
| recipient_email | TEXT | NO | - |
| recipient_phone | TEXT | YES | - |
| subject | TEXT | YES | - |
| body | TEXT | NO | - |
| related_lead_id | UUID | YES | FK leads.id |
| related_project_id | UUID | YES | FK projects.id |
| related_invoice_id | UUID | YES | FK invoices.id |
| sent_at | TIMESTAMPTZ | YES | - |
| failed_at | TIMESTAMPTZ | YES | - |
| error_message | TEXT | YES | - |
| created_at | TIMESTAMPTZ | NO | now() |

---

### 18. activity_log

Audit trail for all CRM actions.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| actor_id | UUID | YES | - |
| actor_type | TEXT | NO | `'team'` |
| action | TEXT | NO | - |
| entity_type | TEXT | NO | - |
| entity_id | UUID | NO | - |
| metadata | JSONB | YES | - |
| created_at | TIMESTAMPTZ | NO | now() |

---

### 19. email_drafts

AI-generated email drafts.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| recipient_email | TEXT | NO | - |
| recipient_name | TEXT | YES | - |
| recipient_lead_id | UUID | YES | FK leads.id |
| recipient_client_id | UUID | YES | FK clients.id |
| subject | TEXT | YES | - |
| body_html | TEXT | YES | - |
| body_text | TEXT | YES | - |
| category | TEXT | YES | - |
| tone | TEXT | YES | - |
| custom_instructions | TEXT | YES | - |
| status | TEXT | NO | `'draft'` |
| sent_at | TIMESTAMPTZ | YES | - |
| created_by | UUID | NO | FK team_users.id |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

---

### 20. in_app_notifications

Real-time in-app notifications for team members.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| user_id | UUID | NO | FK team_users.id |
| type | TEXT | NO | - |
| title | TEXT | NO | - |
| body | TEXT | YES | - |
| link | TEXT | YES | - |
| is_read | BOOLEAN | NO | false |
| created_at | TIMESTAMPTZ | NO | now() |

---

### 21. follow_up_reminders

Automated follow-up reminders with AI-drafted content.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| lead_id | UUID | NO | FK leads.id |
| assigned_to | UUID | YES | FK team_users.id |
| remind_at | TIMESTAMPTZ | NO | - |
| status | TEXT | NO | `'pending'` |
| trigger_reason | TEXT | YES | - |
| ai_draft_subject | TEXT | YES | - |
| ai_draft_body_html | TEXT | YES | - |
| ai_draft_body_text | TEXT | YES | - |
| sent_at | TIMESTAMPTZ | YES | - |
| created_at | TIMESTAMPTZ | NO | now() |

---

### 22. system_settings

Key-value settings store.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | random() |
| key | TEXT | NO | UNIQUE |
| value | JSONB | NO | - |
| updated_by | UUID | YES | FK team_users.id |
| updated_at | TIMESTAMPTZ | NO | now() |

Known keys: `stale_lead_threshold_days`, `notification_preferences`

---

## Entity Relationship Diagram

```
team_users ─────────────────────────────────────────┐
  ├── leads.assigned_to                              │
  ├── clients.created_by                             │
  ├── contacts.created_by                            │
  ├── proposals.created_by                           │
  ├── projects.created_by                            │
  ├── invoices.created_by                            │
  ├── project_demos.created_by                       │
  ├── project_questions.replied_by                   │
  ├── email_drafts.created_by                        │
  ├── in_app_notifications.user_id                   │
  ├── follow_up_reminders.assigned_to                │
  └── system_settings.updated_by                     │
                                                     │
referrers                                            │
  └── leads.referred_by                              │
                                                     │
leads ───────────────────────────────────────────────┤
  ├── contacts.lead_id                               │
  ├── proposals.lead_id                              │
  ├── projects.lead_id                               │
  ├── follow_up_reminders.lead_id                    │
  ├── email_drafts.recipient_lead_id                 │
  └── leads.converted_to_client_id → clients.id      │
                                                     │
clients ─────────────────────────────────────────────┤
  ├── projects.client_id                             │
  ├── proposals.client_id                            │
  ├── invoices.client_id                             │
  ├── contacts.client_id                             │
  ├── project_questions.client_id                    │
  ├── payments.client_id                             │
  └── email_drafts.recipient_client_id               │
                                                     │
projects ────────────────────────────────────────────┤
  ├── project_phases.project_id (CASCADE)            │
  ├── project_milestones.project_id (CASCADE)        │
  ├── project_repos.project_id (CASCADE)             │
  ├── project_demos.project_id (CASCADE)             │
  ├── project_questions.project_id (CASCADE)         │
  └── invoices.project_id                            │
                                                     │
project_phases ──────────────────────────────────────┤
  ├── project_milestones.phase_id (CASCADE)          │
  └── project_demos.phase_id                         │
                                                     │
project_milestones                                   │
  └── invoices.milestone_id                          │
                                                     │
proposals                                            │
  ├── proposal_line_items.proposal_id (CASCADE)      │
  └── projects.proposal_id                           │
                                                     │
invoices                                             │
  ├── invoice_line_items.invoice_id (CASCADE)        │
  └── payments.invoice_id                            │
```

---

## Migration History

| File | Purpose |
|------|---------|
| `0000_melodic_doorman.sql` | Initial schema creation |
| `0001_rls_policies.sql` | Row-level security policies |
| `0002_indexes.sql` | Performance indexes |
| `0003_email_drafts.sql` | Email drafting table |
| `0004_phase5_proposal_tracking.sql` | Proposal tracking enhancements |
| `0005_phase6_follow_up_reminders.sql` | Follow-up reminder system |
| `0007_portal_invite_columns.sql` | Portal invite tracking (6 columns on clients) |
