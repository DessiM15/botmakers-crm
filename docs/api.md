# API Routes & Server Actions

## API Routes

### AI Endpoints

#### `POST /api/ai/analyze-lead`
- **Auth:** requireTeam
- **Body:** `{ leadId }`
- **Action:** Calls Claude to analyze lead, stores result in `leads.ai_internal_analysis` + `leads.ai_prospect_summary`
- **Returns:** `{ analysis }`

#### `POST /api/ai/generate-proposal`
- **Auth:** requireTeam
- **Body:** `{ leadData, discoveryNotes, pricingType }`
- **Action:** Calls Claude to generate proposal content
- **Returns:** `{ title, scope_of_work, deliverables, terms_and_conditions, suggested_line_items }`

#### `POST /api/ai/generate-email`
- **Auth:** requireTeam
- **Body:** `{ recipientName, recipientEmail, recipientCompany, category, holidayType, tone, customInstructions, senderName, recipientHistory }`
- **Action:** Calls Claude to generate email
- **Returns:** `{ subject, body_html, body_text }`

#### `POST /api/ai/polish-reply`
- **Auth:** requireTeam
- **Body:** `{ question, draft, projectName }`
- **Action:** Calls Claude to polish a reply to a client question
- **Returns:** `{ polished }` (text)

### Webhooks

#### `POST /api/webhooks/github`
- **Auth:** HMAC-SHA256 signature verification (`x-hub-signature-256` header)
- **Events:** `push` (updates `project_repos.last_synced_at`, logs activity)
- **Returns:** 200 OK

#### `POST /api/webhooks/vercel`
- **Auth:** HMAC-SHA1 signature verification
- **Events:** `deployment.ready` (auto-pulls demo deployment URL)
- **Returns:** 200 OK

#### `POST /api/webhooks/square`
- **Auth:** HMAC-SHA256 signature verification
- **Events:**
  - `payment.completed` / `invoice.payment_made`: Updates invoice status to `paid`, inserts payment record, sends receipt email, logs activity
  - Idempotent: checks `square_payment_id` to prevent duplicates
- **Returns:** 200 OK

### Notifications

#### `GET /api/notifications`
- **Auth:** requireTeam
- **Returns:** `{ notifications, count }` (unread in-app notifications for current user)

#### `POST /api/notifications/mark-read`
- **Auth:** requireTeam
- **Body:** `{ notificationId }` (or `{ all: true }`)
- **Action:** Marks notification(s) as read

### Invoices

#### `GET /api/invoices/client-projects`
- **Auth:** requireTeam
- **Query:** `?clientId=uuid`
- **Returns:** `{ projects }` (projects for the selected client, used by InvoiceForm)

### Auth

#### `POST /api/auth/sign-in`
- **Auth:** None (public)
- **Rate Limit:** 5 per 15 minutes per IP
- **Body:** `{ email, password }`
- **Action:** Rate limit check only (actual auth happens client-side)

### Cron Jobs

#### `GET /api/cron/stale-leads`
- **Auth:** `CRON_SECRET` header verification
- **Schedule:** Daily
- **Action:** Reads `stale_lead_threshold_days` from system_settings, queries leads not contacted within threshold, sends `staleLeadAlert` notification email to team

#### `GET /api/cron/overdue-milestones`
- **Auth:** `CRON_SECRET` header verification
- **Schedule:** Daily
- **Action:** Queries milestones with `due_date < today` and `status != completed`, updates status to `overdue`, sends `milestoneOverdue` notification email

#### `GET /api/cron/retention-check`
- **Auth:** `CRON_SECRET` header verification
- **Schedule:** Daily
- **Action:** Checks for leads/clients in retention stage needing follow-up

#### `GET /api/cron/portal-welcome-sequence`
- **Auth:** `CRON_SECRET` header verification
- **Schedule:** Daily (2 PM UTC)
- **Action:** Finds clients invited 23-25 hours ago with `portal_invite_count = 1`, sends "Quick Guide" day-2 email

---

## Server Actions

### Lead Actions (`src/lib/actions/leads.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `updateLeadStage` | `leadId, stage` | Changes pipeline stage, logs activity, triggers auto-transitions and notifications |
| `updateLeadNotes` | `leadId, notes` | Saves notes (auto-save on blur) |
| `updateLeadAssignment` | `leadId, teamUserId` | Assigns/unassigns team member, logs activity |
| `createContact` | `leadId, { type, subject, body, direction }` | Logs interaction, updates `last_contacted_at` |
| `convertLeadToClient` | `leadId` | **Workflow 4:** Creates client + Supabase Auth account + welcome email, sets `converted_to_client_id`, advances pipeline to `active_client` |
| `advanceLead` | `leadId, newStage, reason` | Helper for auto-transitions, updates stage and logs |

### Client Actions (`src/lib/actions/clients.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `createClient` | `{ fullName, email, company, phone }` | Creates client record, validates with schema |
| `updateClient` | `clientId, data` | Updates contact info, validates with schema |
| `sendPortalInvite` | `clientId` | Creates Auth user if needed, sends branded invite email, tracks invite count |
| `revokePortalAccess` | `clientId` | Sets `portal_access_revoked`, bans Auth user |
| `restorePortalAccess` | `clientId` | Clears `portal_access_revoked`, unbans Auth user |
| `generatePortalPreviewToken` | `clientId` | HMAC-SHA256 token for admin preview (15 min expiry) |

### Project Actions (`src/lib/actions/projects.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `createProject` | `{ name, clientId, phases, ... }` | Creates project with phases and milestones |
| `updateProject` | `projectId, data` | Updates project details |
| `updateProjectStatus` | `projectId, status` | Changes status, logs activity |
| `createPhase` | `projectId, name, sortOrder` | Adds phase to project |
| `deletePhase` | `phaseId` | Removes phase (CASCADE deletes milestones) |
| `createMilestone` | `phaseId, { title, ... }` | Adds milestone to phase |
| `updateMilestone` | `milestoneId, data` | Updates milestone; if completing with `triggersInvoice=true`, auto-creates invoice (WF-7) |
| `deleteMilestone` | `milestoneId` | Removes milestone |

### Proposal Actions (`src/lib/actions/proposals.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `createProposal` | `{ title, lineItems, ... }` | Creates proposal with line items, logs activity |
| `updateProposal` | `proposalId, data` | Updates draft proposal, replaces line items |
| `sendProposal` | `proposalId` | Sets status to `sent`, sends email via Resend, advances lead pipeline to `proposal_sent` |

### Invoice Actions (`src/lib/actions/invoices.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `createInvoice` | `{ clientId, lineItems, ... }` | Creates invoice with line items |
| `sendViaSquare` | `invoiceId` | Creates Square invoice + publishes + sends, stores `square_invoice_id` and `square_payment_url` |
| `generatePaymentLink` | `invoiceId` | Creates Square checkout payment link |
| `markPaid` | `invoiceId` | Manual payment marking, inserts payment record |
| `sendReminder` | `invoiceId` | Sends payment reminder email |
| `createInvoiceFromMilestone` | `milestoneId, opts` | Auto-creates invoice from milestone completion (WF-7), optionally sends via Square |

### Repo Actions (`src/lib/actions/repos.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `linkRepo` | `projectId, owner, repo` | Validates via GitHub API, creates project_repo record |
| `unlinkRepo` | `repoId` | Removes repo link |
| `syncRepo` | `repoId` | Fetches latest commits from GitHub |
| `createDemo` | `projectId, { title, url, ... }` | Creates demo record |
| `deleteDemo` | `demoId` | Removes demo |
| `toggleDemoApproval` | `demoId` | Toggles `is_approved` (visible on portal when approved) |

### Question Actions (`src/lib/actions/questions.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `saveDraftReply` | `questionId, draft` | Saves draft reply text |
| `sendReply` | `questionId, replyText` | Sends reply, updates question status, emails client |

### Portal Actions (`src/lib/actions/portal.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `sendMagicLink` | `email` | Sends OTP via Supabase Auth |
| `submitQuestion` | `projectId, questionText` | Client submits question, sends notification to team |
| `trackProposalView` | `proposalId` | Increments view count, sets `viewed_at` on first view |
| `acceptProposal` | `proposalId, signature` | Client accepts proposal with signature, sends notification, auto-invites to portal |
| `markOnboardingComplete` | (none, uses session) | Sets `portal_onboarding_complete = true` |

### Settings Actions (`src/lib/actions/settings.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `inviteTeamMember` | `{ email, fullName, role }` | Creates team_users record, sends invite email |
| `toggleTeamMemberActive` | `userId` | Flips `is_active` flag |
| `saveSetting` | `key, value` | Upserts system_settings record |

### Email Actions (`src/lib/actions/emails.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `sendEmailFromCRM` | `{ to, subject, html, ... }` | Sends via Resend, logs to email_drafts |
| `saveDraft` | `draftData` | Saves email draft |
| `getDrafts` | `userId` | Lists drafts for user |
| `loadDraft` | `draftId` | Loads single draft |
| `deleteDraft` | `draftId` | Removes draft |
| `markDraftSent` | `draftId` | Updates draft status to sent |
| `getRecipients` | `search` | Searches leads + clients for autocomplete |

### Follow-Up Actions (`src/lib/actions/follow-ups.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `approveAndSendFollowUp` | `reminderId` | Sends the AI-drafted follow-up email |
| `dismissFollowUp` | `reminderId` | Marks reminder as skipped |

### Auth Actions (`src/lib/actions/auth.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `signOutAction` | (none) | Signs out current user, redirects to sign-in |

### Square Backfill (`src/lib/actions/square-backfill.js`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `backfillSquareHistory` | (none) | Admin only. Imports invoices + payments from Square, matches by client email |

---

## Database Queries

### Lead Queries (`src/lib/db/queries/leads.js`)

| Function | Returns |
|----------|---------|
| `getLeadsByStage()` | Leads grouped by pipeline stage (for Kanban) |
| `getLeadsFiltered(params)` | Paginated leads with search/filter |
| `getLeadById(id)` | Single lead with all fields |
| `getLeadContacts(leadId)` | Contacts for a lead |
| `getTeamMembers()` | Active team users |

### Client Queries (`src/lib/db/queries/clients.js`)

| Function | Returns |
|----------|---------|
| `getClients(params)` | Paginated clients with search |
| `getClientById(id)` | Client with portal columns and counts |
| `getClientByEmail(email)` | Client by email |
| `getReferrers()` | All referrers |
| `getReferrerWithLeads(id)` | Referrer with linked leads |

### Project Queries (`src/lib/db/queries/projects.js`)

| Function | Returns |
|----------|---------|
| `getProjects(params)` | Paginated projects with milestone progress |
| `getProjectById(id)` | Project with phases, milestones, repos, demos |
| `getProjectsByClientId(clientId)` | Projects for a client |
| `getClientsForDropdown()` | Minimal client list |

### Proposal Queries (`src/lib/db/queries/proposals.js`)

| Function | Returns |
|----------|---------|
| `getProposals(params)` | Paginated proposals with filters |
| `getProposalById(id)` | Proposal with line items |
| `getProposalsByClientId(clientId)` | Proposals for a client |
| `getLeadsAndClientsForDropdown()` | Combined dropdown data |

### Invoice Queries (`src/lib/db/queries/invoices.js`)

| Function | Returns |
|----------|---------|
| `getInvoices(params)` | Paginated invoices with filters |
| `getInvoiceById(id)` | Invoice with line items + payments |
| `getInvoicesByClientId(clientId)` | Invoices for a client |
| `getInvoicesByProjectId(projectId)` | Invoices for a project |
| `getInvoiceSummary()` | Outstanding/paid/overdue totals |
| `getClientsForInvoiceDropdown()` | Clients for dropdown |
| `getProjectsForClient(clientId)` | Projects for a client |

### Portal Queries (`src/lib/db/queries/portal.js`)

| Function | Returns |
|----------|---------|
| `getClientProjects(clientId)` | Client's projects with progress |
| `getPortalProject(projectId, clientId)` | Single project (ownership verified) |
| `getPortalProposal(proposalId, clientId)` | Single proposal (ownership verified) |
| `getPortalInvoices(clientId)` | Client's invoices |
| `getPortalInvoice(invoiceId, clientId)` | Single invoice (ownership verified) |
| `getProjectQuestions(projectId)` | Questions for project |
| `getActivityLog(params)` | Paginated activity log with filters |

### Dashboard Queries (`src/lib/db/queries/dashboard.js`)

| Function | Returns |
|----------|---------|
| `getDashboardMetrics()` | Lead count, active projects, revenue, conversion rate |
| `getPipelineSummary()` | Leads per stage |
| `getStaleLeads(thresholdDays)` | Leads not contacted within threshold |
| `getOverdueMilestones()` | Milestones past due date |
| `getPendingQuestions()` | Unanswered client questions |
| `getRecentActivity(limit)` | Recent activity log entries |
| `getPendingFollowUps(userId)` | Follow-up reminders for user |
| `getUnassignedLeads()` | Leads with no assigned team member |
