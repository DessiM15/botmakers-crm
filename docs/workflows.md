# Workflows & Automations

## Core Business Workflows

### WF-1: Lead Intake

```
Website form submit → leads table (source: web_form, stage: new_lead)
                    → newLeadAlert email to team
                    → in-app notification to all team members
```

### WF-2: Pipeline Management

10-stage pipeline with visual Kanban board:

```
new_lead → contacted → discovery_scheduled → discovery_completed
→ proposal_sent → negotiation → contract_signed → active_client
→ project_delivered → retention
```

**Manual transitions:** Click pipeline buttons on lead detail or drag on Kanban board.

**Auto-transitions (6 triggers):**
1. **Lead created** → auto-set to `new_lead`
2. **Contact logged** → if `new_lead`, advance to `contacted`
3. **Proposal created** → if before `proposal_sent`, advance to `proposal_sent`
4. **Proposal accepted** → advance to `contract_signed`
5. **Lead converted to client** → advance to `active_client`
6. **Project completed** → advance to `project_delivered`

**Stage change effects:**
- Logs activity (`pipeline.stage_change`)
- Sends `leadStageChange` notification to team
- Creates follow-up reminder if applicable
- In-app notification to assigned team member

### WF-3: AI Lead Analysis

```
Team member clicks "Run AI Analysis" on lead detail
→ POST /api/ai/analyze-lead
→ Claude analyzes lead data
→ Returns: score, prospect summary, project summary, complexity,
   estimated effort, key questions, red flags, recommended next step
→ Stored in leads.ai_internal_analysis (JSONB) + leads.ai_prospect_summary (TEXT)
```

### WF-4: Lead-to-Client Conversion

```
Team member clicks "Convert to Client" on lead detail
→ Confirm dialog
→ convertLeadToClient(leadId):
  1. Creates client record (copies name, email, phone, company)
  2. Creates Supabase Auth user (or finds existing by email)
  3. Sets client.auth_user_id
  4. Sends welcomeClient email
  5. Sets lead.converted_to_client_id
  6. Advances lead to active_client
  7. Logs activity
  8. Redirects to /clients/[newClientId]
```

### WF-5: Proposal Creation & Sending

```
Create (/proposals/new):
  Step 1 (Context): Select lead/client, set pricing type, enter discovery notes
  → Optional: Generate with AI (Claude creates all content)
  Step 2 (Edit): Edit title, scope, deliverables, terms (ReactQuill), line items
  Step 3 (Preview): Review before saving
  → createProposal() saves to DB

Send:
  Team clicks "Send" on proposal detail
  → sendProposal():
    1. Updates status to 'sent', sets sent_at
    2. Sends proposalSent email with portal link
    3. Advances lead pipeline to 'proposal_sent' (if linked)
    4. Logs activity

Client View (Portal):
  Client clicks link → /portal/proposals/[id]
  → trackProposalView() increments viewed_count, sets viewed_at
  → proposalViewed in-app notification to team

Client Accept:
  Client clicks "Accept & Sign"
  → Modal: agree checkbox + signature input
  → acceptProposal():
    1. Sets status to 'accepted', accepted_at, signer_name, client_signature
    2. Advances lead to 'contract_signed'
    3. Sends proposalAccepted notification to team
    4. Auto-invites to portal (if not already invited)
```

### WF-6: Project Management

```
Create (/projects/new):
  Select client, enter details, customize phase template
  → Default: 4 phases × 3 milestones = 12 milestones
  → createProject() inserts project + phases + milestones

Track:
  MilestoneEditor on project detail:
  → Status changes: pending → in_progress → completed
  → Due dates, descriptions, invoice triggers
  → Progress bar auto-calculates from completed/total

GitHub Integration:
  Link repos → view commits → receive push webhooks
  Create demos → approve for portal → auto-pull from Vercel

Questions (Portal):
  Client submits question → team gets notification
  → Team drafts reply → optional AI polish → send
  → Client gets email + sees reply in portal
```

### WF-7: Milestone-to-Invoice Auto-Creation

```
Milestone has triggers_invoice = true and invoice_amount set
→ Team marks milestone as 'completed' in MilestoneEditor
→ updateMilestone() detects triggersInvoice flag
→ createInvoiceFromMilestone():
  1. Creates invoice (title: "Invoice: {milestone title}")
  2. Single line item with milestone amount
  3. If Square configured: auto-sends via Square
  4. Logs activity
  5. Returns invoice for confirmation toast
```

### WF-8: Invoice & Payment

```
Create Invoice:
  Manual: /invoices/new → fill form → save draft
  Auto: Milestone completion (WF-7)

Send:
  Option A: Send via Square
    → createSquareInvoice(): customer lookup → order → invoice → publish
    → Stores square_invoice_id and square_payment_url
  Option B: Generate payment link
    → createSquareCheckoutLink(): creates payment link
    → Stores square_payment_url

Payment:
  Client pays via Square checkout/invoice
  → Square webhook fires
  → /api/webhooks/square:
    1. Verifies HMAC signature
    2. Finds invoice by square_invoice_id
    3. Checks idempotency (square_payment_id)
    4. Updates invoice: status='paid', paid_at=now
    5. Inserts payment record
    6. Sends paymentReceipt email to client
    7. Sends paymentReceived notification to team
    8. Logs activity

Manual Payment:
  markPaid(invoiceId) → creates payment record with method='manual'
```

### WF-9: Portal Onboarding

```
1. Team sends portal invite (or auto-invite on proposal accept)
   → Creates Supabase Auth user
   → Sends branded invite email
   → Sets portal_invited_at, portal_invite_count

2. Client clicks magic link in email
   → Authenticates via OTP
   → Redirected to /portal

3. First visit: portal_onboarding_complete = false
   → Redirect to /portal/welcome
   → 4-slide walkthrough
   → "Go to My Portal" or "Skip"
   → markOnboardingComplete()

4. Subsequent visits:
   → Portal home: project cards with progress
   → Login tracked: portal_last_login_at, portal_first_login_at

5. Day-2 email (cron):
   → Clients invited 23-25 hours ago, invite_count = 1
   → "Quick Guide" email with portal tips
```

### WF-10: Email Generation

```
Team member opens /email-generator
→ Search/select recipient (leads + clients autocomplete)
→ Choose category (9 types) and tone (3 types)
→ Optional: custom instructions
→ Click "Generate" → Claude creates email
→ Review HTML preview
→ Edit subject/body if needed
→ Save as draft or Send via Resend
→ If sent: update draft status, log activity
```

**Email Categories:**
1. Follow-Up (after call/meeting)
2. Introduction (cold outreach)
3. Proposal Follow-Up (nudge)
4. Check-In (general)
5. Thank You (signing/payment/referral)
6. Project Update (milestone/progress)
7. Holiday Greeting (with specific holiday selector)
8. Win-Back (re-engage stale lead)
9. Referral Request (ask happy client)

**Tones:** Professional, Friendly, Casual

---

## Automated Notifications

### Email Notifications (via Resend)

| Event | Template | Recipients |
|-------|----------|------------|
| New lead created | `newLeadAlert` | All team members |
| Pipeline stage change | `leadStageChange` | All team members |
| Proposal accepted | `proposalAccepted` | All team members |
| Payment received | `paymentReceived` | Client (receipt) + team |
| Client question | `clientQuestion` | All team members |
| Milestone overdue (cron) | `milestoneOverdue` | All team members |
| Stale lead detected (cron) | `staleLeadAlert` | All team members |
| Milestone completed | `milestoneCompletedEmail` | All team members |
| Question replied | `questionRepliedEmail` | Client |
| Portal invite | `portalInvite` | Client |
| Welcome email | `welcomeClient` | Client |
| Proposal sent | `proposalSent` | Client |
| Invoice sent | `invoiceSent` | Client |

### In-App Notifications (via NotificationBell)

| Type | Trigger |
|------|---------|
| `pipeline_move` | Lead stage change |
| `proposal_viewed` | Proposal viewed by client |
| `proposal_signed` | Proposal accepted |
| `lead_assigned` | Lead assignment change |
| `milestone_completed` | Milestone completed |
| `project_completed` | Project completed |
| `demo_approved` | Demo approved for portal |
| `client_question` | Client submits question |
| `follow_up_reminder` | Follow-up is due |

Polled every 30 seconds via `/api/notifications`.

---

## Cron Jobs

| Job | Schedule | File | Action |
|-----|----------|------|--------|
| Stale Leads | Daily | `/api/cron/stale-leads` | Detects leads not contacted within threshold days, sends alert |
| Overdue Milestones | Daily | `/api/cron/overdue-milestones` | Detects past-due milestones, updates status, sends alert |
| Retention Check | Daily | `/api/cron/retention-check` | Checks retention-stage clients needing follow-up |
| Portal Welcome Sequence | Daily 2PM UTC | `/api/cron/portal-welcome-sequence` | Day-2 guide email for newly invited clients |

All cron jobs verify `CRON_SECRET` header for authentication. Configured in `vercel.json`.

---

## Follow-Up Reminders

```
Trigger (stage change, contact logged, time-based):
→ Creates follow_up_reminder with remind_at timestamp
→ Claude generates AI draft email (subject + HTML + text body)
→ Reminder appears in FollowUpQueue on dashboard

Team member reviews:
→ Preview AI draft
→ Click "Approve & Send" → sends email, removes from queue
→ Or "Dismiss" → marks as skipped
```

---

## Activity Logging

Every significant CRM action is logged to `activity_log` with:
- `actor_id` + `actor_type` (team/client/system)
- `action` (e.g., `lead.stage_change`, `project.milestone_completed`, `portal.login`)
- `entity_type` + `entity_id` (e.g., `lead`, `abc-123`)
- `metadata` (JSONB — old/new values, context)

Viewable at `/activity` with filters for actor, entity type, and date range.
