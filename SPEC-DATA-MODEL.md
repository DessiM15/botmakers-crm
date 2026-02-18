# SPEC-DATA-MODEL.md — Botmakers CRM v2

## IMPORTANT: Existing Tables

The Supabase project (`botmakers-intake`) already has tables from the website and from the previous build attempt. The build prompts will specify exactly how to handle each:

- **leads** — EXISTS. May need new columns added. Do NOT drop or alter existing columns.
- **referrers** — EXISTS. May need new columns added. Do NOT drop or alter existing columns.
- All other tables — created by previous build. Drop and recreate cleanly if they exist.

---

## Enums

```sql
CREATE TYPE lead_source AS ENUM ('web_form', 'referral', 'vapi', 'cold_outreach', 'word_of_mouth', 'other');
CREATE TYPE lead_score AS ENUM ('high', 'medium', 'low');
CREATE TYPE pipeline_stage AS ENUM ('new_lead', 'contacted', 'discovery_scheduled', 'discovery_completed', 'proposal_sent', 'negotiation', 'contract_signed', 'active_client', 'project_delivered', 'retention');
CREATE TYPE project_status AS ENUM ('draft', 'in_progress', 'paused', 'completed', 'cancelled');
CREATE TYPE milestone_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue');
CREATE TYPE proposal_status AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled');
CREATE TYPE pricing_type AS ENUM ('fixed', 'phased', 'hourly');
CREATE TYPE payment_method AS ENUM ('square_invoice', 'square_checkout', 'manual', 'other');
CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'in_app');
CREATE TYPE notification_type AS ENUM ('lead_new', 'lead_stage_change', 'proposal_accepted', 'payment_received', 'client_question', 'milestone_overdue', 'lead_stale');
CREATE TYPE team_role AS ENUM ('admin', 'member');
CREATE TYPE question_status AS ENUM ('pending', 'replied');
```

---

## Table: team_users

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | Matches Supabase Auth user ID |
| email | TEXT | No | — | Unique |
| full_name | TEXT | No | — | |
| role | team_role | No | 'admin' | |
| avatar_url | TEXT | Yes | NULL | |
| is_active | BOOLEAN | No | true | |
| created_at | TIMESTAMPTZ | No | now() | |
| updated_at | TIMESTAMPTZ | No | now() | |

---

## Table: clients

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| email | TEXT | No | — | Unique |
| full_name | TEXT | No | — | |
| company | TEXT | Yes | NULL | |
| phone | TEXT | Yes | NULL | |
| notes | TEXT | Yes | NULL | |
| auth_user_id | UUID | Yes | NULL | FK to Supabase Auth. Set when portal created. |
| created_by | UUID | Yes | NULL | FK to team_users.id |
| created_at | TIMESTAMPTZ | No | now() | |
| updated_at | TIMESTAMPTZ | No | now() | |

---

## Table: leads (EXISTS — add columns only)

Existing columns from website form stay untouched. New CRM columns to add:

| New Column | Type | Nullable | Default | Notes |
|------------|------|----------|---------|-------|
| score | lead_score | Yes | NULL | Set by AI analysis |
| pipeline_stage | pipeline_stage | No | 'new_lead' | |
| pipeline_stage_changed_at | TIMESTAMPTZ | No | now() | |
| ai_internal_analysis | JSONB | Yes | NULL | |
| ai_prospect_summary | TEXT | Yes | NULL | |
| converted_to_client_id | UUID | Yes | NULL | FK to clients.id |
| assigned_to | UUID | Yes | NULL | FK to team_users.id |
| notes | TEXT | Yes | NULL | Team notes |
| last_contacted_at | TIMESTAMPTZ | Yes | NULL | |

**Do NOT drop or rename existing columns.** Only ADD new ones.

---

## Table: referrers (EXISTS — add columns only)

| New Column | Type | Nullable | Default | Notes |
|------------|------|----------|---------|-------|
| ai_feedback_analysis | JSONB | Yes | NULL | |

---

## Table: contacts

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| lead_id | UUID | Yes | NULL | FK to leads.id |
| client_id | UUID | Yes | NULL | FK to clients.id |
| type | TEXT | No | — | 'email', 'phone', 'sms', 'meeting', 'note' |
| subject | TEXT | Yes | NULL | |
| body | TEXT | Yes | NULL | |
| direction | TEXT | No | 'outbound' | |
| created_by | UUID | Yes | NULL | FK to team_users.id |
| created_at | TIMESTAMPTZ | No | now() | |

---

## Table: proposals

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| lead_id | UUID | Yes | NULL | |
| client_id | UUID | Yes | NULL | |
| project_id | UUID | Yes | NULL | Linked after acceptance |
| title | TEXT | No | — | |
| scope_of_work | TEXT | No | — | Rich text |
| deliverables | TEXT | No | — | Rich text |
| terms_and_conditions | TEXT | No | — | Rich text |
| pricing_type | pricing_type | No | 'fixed' | |
| total_amount | DECIMAL(10,2) | No | 0 | |
| status | proposal_status | No | 'draft' | |
| sent_at | TIMESTAMPTZ | Yes | NULL | |
| viewed_at | TIMESTAMPTZ | Yes | NULL | |
| accepted_at | TIMESTAMPTZ | Yes | NULL | |
| declined_at | TIMESTAMPTZ | Yes | NULL | |
| expires_at | TIMESTAMPTZ | Yes | NULL | |
| client_signature | TEXT | Yes | NULL | |
| ai_generated | BOOLEAN | No | false | |
| ai_prompt_context | TEXT | Yes | NULL | |
| created_by | UUID | No | — | FK to team_users.id |
| created_at | TIMESTAMPTZ | No | now() | |
| updated_at | TIMESTAMPTZ | No | now() | |

---

## Table: proposal_line_items

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| proposal_id | UUID | No | — | FK ON DELETE CASCADE |
| description | TEXT | No | — | |
| quantity | DECIMAL(10,2) | No | 1 | |
| unit_price | DECIMAL(10,2) | No | 0 | |
| total | DECIMAL(10,2) | No | 0 | |
| sort_order | INTEGER | No | 0 | |
| phase_label | TEXT | Yes | NULL | For phased pricing |
| created_at | TIMESTAMPTZ | No | now() | |

---

## Table: projects

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| name | TEXT | No | — | |
| client_id | UUID | No | — | FK to clients.id |
| proposal_id | UUID | Yes | NULL | |
| lead_id | UUID | Yes | NULL | |
| project_type | TEXT | Yes | NULL | |
| description | TEXT | Yes | NULL | |
| status | project_status | No | 'draft' | |
| pricing_type | pricing_type | No | 'fixed' | |
| total_value | DECIMAL(10,2) | No | 0 | |
| start_date | DATE | Yes | NULL | |
| target_end_date | DATE | Yes | NULL | |
| actual_end_date | DATE | Yes | NULL | |
| created_by | UUID | No | — | FK to team_users.id |
| created_at | TIMESTAMPTZ | No | now() | |
| updated_at | TIMESTAMPTZ | No | now() | |

---

## Table: project_phases

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| project_id | UUID | No | — | FK ON DELETE CASCADE |
| name | TEXT | No | — | |
| sort_order | INTEGER | No | 0 | |
| created_at | TIMESTAMPTZ | No | now() | |

---

## Table: project_milestones

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| project_id | UUID | No | — | FK ON DELETE CASCADE |
| phase_id | UUID | No | — | FK ON DELETE CASCADE |
| title | TEXT | No | — | |
| description | TEXT | Yes | NULL | |
| status | milestone_status | No | 'pending' | |
| sort_order | INTEGER | No | 0 | |
| due_date | DATE | Yes | NULL | |
| completed_at | TIMESTAMPTZ | Yes | NULL | |
| triggers_invoice | BOOLEAN | No | false | |
| invoice_amount | DECIMAL(10,2) | Yes | NULL | |
| created_at | TIMESTAMPTZ | No | now() | |
| updated_at | TIMESTAMPTZ | No | now() | |

---

## Table: project_repos

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| project_id | UUID | No | — | FK ON DELETE CASCADE |
| github_owner | TEXT | No | — | |
| github_repo | TEXT | No | — | |
| github_url | TEXT | No | — | |
| default_branch | TEXT | No | 'main' | |
| last_synced_at | TIMESTAMPTZ | Yes | NULL | |
| created_at | TIMESTAMPTZ | No | now() | |

---

## Table: project_demos

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| project_id | UUID | No | — | FK ON DELETE CASCADE |
| title | TEXT | No | — | |
| url | TEXT | No | — | |
| description | TEXT | Yes | NULL | |
| phase_id | UUID | Yes | NULL | |
| is_auto_pulled | BOOLEAN | No | false | |
| is_approved | BOOLEAN | No | false | Client only sees approved |
| created_by | UUID | Yes | NULL | |
| created_at | TIMESTAMPTZ | No | now() | |

---

## Table: project_questions

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| project_id | UUID | No | — | FK ON DELETE CASCADE |
| client_id | UUID | No | — | FK to clients.id |
| question_text | TEXT | No | — | |
| status | question_status | No | 'pending' | |
| reply_draft | TEXT | Yes | NULL | |
| reply_text | TEXT | Yes | NULL | |
| replied_by | UUID | Yes | NULL | |
| replied_at | TIMESTAMPTZ | Yes | NULL | |
| created_at | TIMESTAMPTZ | No | now() | |

---

## Table: invoices

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| client_id | UUID | No | — | |
| project_id | UUID | Yes | NULL | |
| milestone_id | UUID | Yes | NULL | |
| square_invoice_id | TEXT | Yes | NULL | |
| square_payment_url | TEXT | Yes | NULL | |
| title | TEXT | No | — | |
| description | TEXT | Yes | NULL | |
| amount | DECIMAL(10,2) | No | 0 | |
| status | invoice_status | No | 'draft' | |
| sent_at | TIMESTAMPTZ | Yes | NULL | |
| viewed_at | TIMESTAMPTZ | Yes | NULL | |
| paid_at | TIMESTAMPTZ | Yes | NULL | |
| due_date | DATE | Yes | NULL | |
| created_by | UUID | No | — | |
| created_at | TIMESTAMPTZ | No | now() | |
| updated_at | TIMESTAMPTZ | No | now() | |

---

## Table: invoice_line_items

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| invoice_id | UUID | No | — | FK ON DELETE CASCADE |
| description | TEXT | No | — | |
| quantity | DECIMAL(10,2) | No | 1 | |
| unit_price | DECIMAL(10,2) | No | 0 | |
| total | DECIMAL(10,2) | No | 0 | |
| sort_order | INTEGER | No | 0 | |
| created_at | TIMESTAMPTZ | No | now() | |

---

## Table: payments

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| invoice_id | UUID | No | — | |
| client_id | UUID | No | — | |
| square_payment_id | TEXT | Yes | NULL | |
| amount | DECIMAL(10,2) | No | 0 | |
| method | payment_method | No | 'square_invoice' | |
| paid_at | TIMESTAMPTZ | No | now() | |
| created_at | TIMESTAMPTZ | No | now() | |

---

## Table: notifications

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| type | notification_type | No | — | |
| channel | notification_channel | No | 'email' | |
| recipient_email | TEXT | No | — | |
| recipient_phone | TEXT | Yes | NULL | |
| subject | TEXT | Yes | NULL | |
| body | TEXT | No | — | |
| related_lead_id | UUID | Yes | NULL | |
| related_project_id | UUID | Yes | NULL | |
| related_invoice_id | UUID | Yes | NULL | |
| sent_at | TIMESTAMPTZ | Yes | NULL | |
| failed_at | TIMESTAMPTZ | Yes | NULL | |
| error_message | TEXT | Yes | NULL | |
| created_at | TIMESTAMPTZ | No | now() | |

---

## Table: activity_log

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| actor_id | UUID | Yes | NULL | |
| actor_type | TEXT | No | 'team' | 'team', 'client', 'system' |
| action | TEXT | No | — | e.g. 'lead.created' |
| entity_type | TEXT | No | — | 'lead', 'project', etc. |
| entity_id | UUID | No | — | |
| metadata | JSONB | Yes | NULL | |
| created_at | TIMESTAMPTZ | No | now() | |

---

## Table: system_settings

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| key | TEXT | No | — | Unique |
| value | JSONB | No | — | |
| updated_by | UUID | Yes | NULL | |
| updated_at | TIMESTAMPTZ | No | now() | |

---

## Table: email_drafts

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID (PK) | No | gen_random_uuid() | |
| recipient_email | TEXT | No | — | |
| recipient_name | TEXT | Yes | NULL | |
| recipient_lead_id | UUID | Yes | NULL | FK → leads |
| recipient_client_id | UUID | Yes | NULL | FK → clients |
| subject | TEXT | Yes | NULL | |
| body_html | TEXT | Yes | NULL | |
| body_text | TEXT | Yes | NULL | |
| category | TEXT | Yes | NULL | follow_up, introduction, proposal_follow_up, check_in, thank_you, project_update, holiday, win_back, referral_request |
| tone | TEXT | Yes | NULL | professional, friendly, casual |
| custom_instructions | TEXT | Yes | NULL | |
| status | TEXT | No | 'draft' | draft, sent |
| sent_at | TIMESTAMPTZ | Yes | NULL | |
| created_by | UUID | No | — | FK → team_users |
| created_at | TIMESTAMPTZ | No | now() | |
| updated_at | TIMESTAMPTZ | No | now() | |

RLS: Team members can CRUD all drafts.

---

## Default Project Phases Template

| Phase | Sort | Default Milestones |
|-------|------|--------------------|
| Discovery | 1 | Initial consultation, Requirements documented, Project plan approved |
| MVP Build | 2 | Dev environment setup, Core features implemented, Internal testing passed |
| Revision | 3 | Client feedback collected, Revisions implemented, Final testing passed |
| Launch | 4 | Deployment completed, Client training done, Project handoff complete |
