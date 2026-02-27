# Pages & Components

## CRM Pages (20)

All CRM pages are wrapped in `MasterLayout` (sidebar + header).

### Dashboard — `/`
- **Type:** Server component
- **Data:** Metrics (lead count, active projects, revenue, conversion rate), pipeline summary, stale leads, overdue milestones, pending questions, recent activity, follow-up queue, unassigned leads
- **Components:** MetricCards, AlertsPanel, ActivityFeed, PipelineStageChart, LeadSourceChart, FollowUpQueue, UnassignedLeadsWidget

### Pipeline — `/pipeline`
- **Type:** Server component
- **Data:** Leads grouped by pipeline stage, team members
- **Components:** PipelineBoard (Kanban with drag-and-drop via @hello-pangea/dnd)
- **Features:** 10 droppable columns, client-side filters (source, score, assignedTo), optimistic UI on drag

### Leads List — `/leads`
- **Type:** Server component with searchParams-based filtering
- **Data:** Paginated leads with filters
- **Components:** LeadTable
- **Features:** Debounced search (300ms), 4 filter dropdowns, pagination (10/25/50), inline stage dropdown, skeleton loading

### Lead Detail — `/leads/[id]`
- **Type:** Server component
- **Data:** Lead record, contacts, team members, follow-ups
- **Components:** LeadDetail
- **Features:** Contact info card, 10-stage pipeline selector, notes auto-save, AI analysis panel, contact log timeline, log contact modal, assigned-to dropdown, convert to client, create proposal link, follow-up queue

### Referrals — `/referrals`
- **Type:** Server component
- **Data:** Referrers with linked leads
- **Components:** ReferralTable
- **Features:** Expandable rows per referrer showing linked leads

### Clients List — `/clients`
- **Type:** Server component
- **Data:** Paginated clients
- **Components:** ClientTable
- **Features:** Search, pagination, add client modal, portal status badges

### Client Detail — `/clients/[id]`
- **Type:** Server component
- **Data:** Client record, projects, proposals, invoices
- **Components:** ClientDetail (tabbed)
- **Tabs:**
  1. **Overview:** Editable contact form, notes, Portal Access card (4-state interactive)
  2. **Projects:** Linked projects with progress bars
  3. **Proposals:** Proposals table with status
  4. **Invoices:** Invoices table with amounts
  5. **Questions:** Placeholder
  6. **Activity:** Placeholder

### Projects List — `/projects`
- **Type:** Server component
- **Data:** Paginated projects with milestone/progress subqueries
- **Components:** ProjectList (card grid)
- **Features:** Search, status filter, client filter, card grid (3 cols XL, 2 cols LG/MD)

### Create Project — `/projects/new`
- **Type:** Server component
- **Data:** Clients dropdown
- **Components:** ProjectForm
- **Features:** Editable phase template (4 default phases, 12 milestones), date pickers, pricing type, client selection

### Project Detail — `/projects/[id]`
- **Type:** Server component
- **Data:** Project with phases, milestones, repos, demos, invoices, questions
- **Components:** ProjectDetail (tabbed)
- **Tabs:**
  1. **Overview:** Editable fields, status dropdown, linked client
  2. **Milestones:** MilestoneEditor (accordion phases, status dropdowns, due dates, invoice triggers)
  3. **Repos & Demos:** ReposDemosTab (GitHub linking, demo approval)
  4. **Questions:** QuestionReply (draft/polish/send replies)
  5. **Invoices:** Linked invoices table

### Proposals List — `/proposals`
- **Type:** Server component
- **Data:** Paginated proposals with filters
- **Components:** ProposalList
- **Features:** Status filter, search, pagination, tracking badges

### Create Proposal — `/proposals/new`
- **Type:** Server component
- **Data:** Leads and clients for dropdown
- **Components:** ProposalWizard (3-step)
- **Steps:** Context (select lead/client, AI generate) -> Edit (ReactQuill, line items) -> Preview
- **Supports:** `?lead_id=` query param for preselection

### Proposal Detail — `/proposals/[id]`
- **Type:** Server component
- **Data:** Proposal with line items
- **Components:** ProposalDetail
- **Features:** Status timeline, content preview, line items, send button (draft only)

### Invoices List — `/invoices`
- **Type:** Server component
- **Data:** Paginated invoices, summary totals
- **Components:** InvoiceTable
- **Features:** 3 summary cards (outstanding, paid this month, overdue), search, status filter, pagination

### Create Invoice — `/invoices/new`
- **Type:** Server component
- **Data:** Clients, Square configuration
- **Components:** InvoiceForm
- **Features:** Client/project dropdowns, line items, save draft / send via Square / generate payment link
- **Supports:** `?client_id=`, `?project_id=`, `?milestone=`, `?amount=` query params

### Invoice Detail — `/invoices/[id]`
- **Type:** Server component
- **Data:** Invoice with line items, payments, Square config
- **Components:** InvoiceDetail
- **Features:** Status timeline, payment history, line items, actions (send, mark paid, reminder, payment link)

### Email Generator — `/email-generator`
- **Type:** Server component
- **Data:** Team user
- **Components:** EmailGenerator
- **Features:** Recipient autocomplete (leads/clients), 9 categories, 3 tones, AI generation via Claude, HTML preview, draft management, send via Resend

### Settings — `/settings`
- **Type:** Server component
- **Data:** Integration status, team members, system settings
- **Components:** SettingsPage (tabbed)
- **Tabs:**
  1. **Integrations:** GitHub/Square status, webhook URLs, Square backfill
  2. **Team:** Member list, invite, activate/deactivate
  3. **Notifications:** Stale lead threshold, notification types

### Activity Log — `/activity`
- **Type:** Server component
- **Data:** Paginated activity log with filters
- **Components:** ActivityLogView
- **Features:** Filters (actor, entity type), action icons, entity links, relative timestamps

### Sign-In — `/sign-in`
- **Type:** Client component
- **Data:** None (client-side auth)
- **Components:** SignInLayer (customized WowDash)
- **Features:** Botmakers branding, email/password form, rate limiting

---

## Portal Pages (6)

All portal pages use `PortalLayout` (light theme, navy header).

### Portal Login — `/portal/login`
- **Type:** Client component
- **Features:** Email input, magic link OTP, rate limit 3/hr, validates client exists, handles `?error=access_revoked`

### Portal Home — `/portal`
- **Type:** Server component
- **Data:** Client projects
- **Behavior:** 0 projects -> empty state, 1 project -> redirect to project, 2+ -> card grid with progress bars
- **Features:** Login tracking, onboarding redirect, access revocation check

### Portal Welcome — `/portal/welcome`
- **Type:** Client component
- **Features:** 4-slide walkthrough with navy background, progress dots, skip link, calls `markOnboardingComplete()` on completion

### Portal Project — `/portal/projects/[id]`
- **Type:** Server component
- **Components:** PortalProgressBar, PortalMilestones, PortalDemoGallery, PortalQuestionForm
- **Features:** Progress overview, "What's Next" (3 upcoming milestones), collapsible phases, approved demos gallery, Q&A form

### Portal Proposal — `/portal/proposals/[id]`
- **Type:** Server component
- **Components:** PortalProposalDetail
- **Features:** Read-only content, view tracking, Accept & Sign modal (checkbox + signature), expired/declined handling

### Portal Invoices — `/portal/invoices` + `/portal/invoices/[id]`
- **Type:** Server components
- **Features:** Invoice list with Pay button, detail with Pay Now -> Square checkout link

### Portal Preview — `/portal/preview`
- **Type:** Server component
- **Features:** Token verification (HMAC-SHA256), renders portal as admin, yellow preview banner, interactive elements disabled

---

## CRM Components (40+)

### Dashboard Components

| Component | Props | Key Features |
|-----------|-------|--------------|
| MetricCards | `metrics` | 4 cards (leads, projects, revenue, conversion), gradient backgrounds |
| AlertsPanel | `alerts` | Stale leads, overdue milestones, pending questions |
| ActivityFeed | `activity` | Timeline feed with icons and entity links |
| PipelineStageChart | `data` | ApexCharts bar chart of leads per stage |
| LeadSourceChart | `data` | ApexCharts donut chart of leads by source |
| FollowUpQueue | `followUps` | Queue with approve/dismiss, AI draft preview |
| UnassignedLeadsWidget | `leads` | Unassigned leads list with assign dropdown |
| NotificationBell | (none) | Header bell icon, dropdown with unread notifications, 30s polling |

### Lead Components

| Component | Props | Key Features |
|-----------|-------|--------------|
| LeadTable | `initialData`, `teamMembers` | Search, 4 filters, pagination, inline stage dropdown |
| LeadDetail | `lead`, `contacts`, `teamMembers`, `followUps` | Pipeline selector, AI analysis, contact log, convert to client |

### Client Components

| Component | Props | Key Features |
|-----------|-------|--------------|
| ClientTable | `initialData` | Search, pagination, add modal, portal status badges |
| ClientDetail | `client`, `clientProjects`, `clientProposals`, `clientInvoices` | 6 tabs, editable form, Portal Access card (4 states) |
| ReferralTable | `referrers`, `referrerLeads` | Expandable rows per referrer |

### Project Components

| Component | Props | Key Features |
|-----------|-------|--------------|
| ProjectList | `initialData`, `clientOptions` | Card grid, search, status/client filters |
| ProjectCard | `project` | Card with progress bar, status color |
| ProjectForm | `clients`, `defaultClientId`, `defaultLeadId` | Editable phase template, date pickers |
| ProjectDetail | `project`, `projectInvoices`, `projectQuestions` | 5 tabs, editable overview, milestone editor |
| MilestoneEditor | `projectId`, `phases`, `onProgressChange` | Accordion, status dropdowns, due dates, invoice triggers |
| ReposDemosTab | `projectId`, `repos`, `demos`, `phases` | GitHub linking, commit history, demo gallery, approval toggle |

### Proposal Components

| Component | Props | Key Features |
|-----------|-------|--------------|
| ProposalList | `proposals`, pagination props | Status filter, search, pagination |
| ProposalWizard | `leads`, `clients`, `preselectedLeadId` | 3-step wizard, AI generation, ReactQuill editors, line items |
| ProposalDetail | `proposal` | Status timeline, content, line items, send button |

### Invoice Components

| Component | Props | Key Features |
|-----------|-------|--------------|
| InvoiceTable | `invoices`, pagination props, `summary` | 3 summary cards, search, filter |
| InvoiceForm | `clients`, preselect props, `squareConfigured` | Client/project dropdowns, line items, Square integration |
| InvoiceDetail | `invoice`, `squareConfigured` | Status timeline, payment history, Square sync |

### Pipeline Components

| Component | Props | Key Features |
|-----------|-------|--------------|
| PipelineBoard | `initialLeads`, `teamMembers` | Kanban drag-and-drop, 10 columns, filters |
| PipelineCard | `lead`, `isDragging` | Card with score/source badges |

### Q&A Components

| Component | Props | Key Features |
|-----------|-------|--------------|
| QuestionReply | `projectId`, `projectName`, `questions` | Draft, AI polish, send |

### Portal Components

| Component | Props | Key Features |
|-----------|-------|--------------|
| PortalLayout | `children`, `isPreview`, `clientName` | Light theme header, preview banner, logout |
| PortalProgressBar | `progress`, `completed`, `total` | Single progress bar |
| PortalMilestones | `phases` | Accordion with status indicators |
| PortalDemoGallery | `demos` | Approved demo gallery |
| PortalQuestionForm | `projectId`, `questions` | Question submit + Q&A history |
| PortalProposalDetail | `proposal`, `clientName`, `isPreview` | Accept & Sign modal, status handling |

### Email Component

| Component | Props | Key Features |
|-----------|-------|--------------|
| EmailGenerator | `teamUser` | 9 categories, 3 tones, AI generation, drafts, send |

### Settings Components

| Component | Props | Key Features |
|-----------|-------|--------------|
| SettingsPage | integration/team/settings props | 3 tabs |
| SettingsIntegrations | `githubConfigured`, `squareConfigured`, `siteUrl` | Status cards, webhook URLs, backfill |
| ActivityLogView | `entries`, pagination props, `filters` | Paginated feed, filters, entity links |

### Shared Components

| Component | Props | Key Features |
|-----------|-------|--------------|
| PWASetup | (none) | Service worker registration, install banner |

---

## Navigation Flow

### CRM

```
Dashboard (/)
  ├─> Pipeline (/pipeline) ─── drag card ──> updates lead stage
  │                            click card ──> Lead Detail
  ├─> Leads (/leads) ──────── click row ───> Lead Detail (/leads/[id])
  │                                          ├─> Convert to Client ──> Client Detail
  │                                          └─> Create Proposal ───> Proposal Wizard
  ├─> Clients (/clients) ──── click row ───> Client Detail (/clients/[id])
  │                            add modal ──> creates client
  │                                          ├─> Projects tab ──> Project Detail
  │                                          ├─> Proposals tab ─> Proposal Detail
  │                                          ├─> Invoices tab ──> Invoice Detail
  │                                          └─> Portal Access ─> invite/revoke/preview
  ├─> Projects (/projects) ── click card ──> Project Detail (/projects/[id])
  │    new (/projects/new) ─── submit ────> Project Detail
  │                                          ├─> Milestones ────> milestone completion ──> auto-invoice
  │                                          ├─> Repos & Demos ─> GitHub/Vercel integration
  │                                          └─> Questions ─────> AI-polished replies
  ├─> Proposals (/proposals)── click row ──> Proposal Detail (/proposals/[id])
  │    new (/proposals/new) ── wizard ────> creates proposal ──> send via email
  ├─> Invoices (/invoices) ── click row ──> Invoice Detail (/invoices/[id])
  │    new (/invoices/new) ─── form ──────> send via Square / payment link
  ├─> Email Generator (/email-generator) ── generate + send
  ├─> Settings (/settings) ── team/integrations/notifications
  └─> Activity Log (/activity) ── filtered event feed
```

### Portal

```
Login (/portal/login) ── magic link ──> email OTP
  └─> Portal Home (/portal)
       ├─> Welcome (/portal/welcome) ── 4-slide walkthrough (first time only)
       ├─> Project (/portal/projects/[id]) ── milestones, demos, questions
       ├─> Proposal (/portal/proposals/[id]) ── view + accept & sign
       └─> Invoices (/portal/invoices) ── list + pay via Square
```
