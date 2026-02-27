# Integrations

## Square (Payments)

**File:** `src/lib/integrations/square.js`
**SDK:** `square` (Node SDK)
**Environment:** PRODUCTION credentials

### Configuration
- `SQUARE_ACCESS_TOKEN` — API access token
- `SQUARE_ENVIRONMENT` — `production` or `sandbox`
- `SQUARE_WEBHOOK_SIGNATURE_KEY` — Webhook HMAC verification

### Functions

| Function | Description |
|----------|-------------|
| `isSquareConfigured()` | Returns true if `SQUARE_ACCESS_TOKEN` is set |
| `getSquareEnvironment()` | Returns current environment string |
| `createSquareInvoice(invoice, client, lineItems)` | Creates customer (lookup by email), order, invoice, publishes + sends. Returns `{ squareInvoiceId, paymentUrl }` |
| `createSquareCheckoutLink(invoice, client, lineItems)` | Creates a payment link for direct checkout. Returns `{ url }` |
| `getSquareInvoices(cursor)` | Lists Square invoices (for backfill) |
| `getSquarePayments(cursor)` | Lists Square payments (for backfill) |

### Webhook (`/api/webhooks/square`)
- **Verification:** HMAC-SHA256 using `SQUARE_WEBHOOK_SIGNATURE_KEY`
- **Events handled:**
  - `payment.completed` / `invoice.payment_made`:
    1. Finds local invoice by `square_invoice_id`
    2. Checks idempotency via `square_payment_id`
    3. Updates invoice status to `paid`, sets `paid_at`
    4. Inserts payment record
    5. Sends receipt email to client
    6. Logs activity

### Backfill
- `backfillSquareHistory()` — Admin-only action that imports historical invoices and payments from Square
- Matches by client email address
- Creates local invoice + payment records for Square records

---

## GitHub (Version Control)

**File:** `src/lib/integrations/github.js`
**SDK:** `@octokit/rest` (Octokit)

### Configuration
- `GITHUB_TOKEN` — Personal access token
- `GITHUB_WEBHOOK_SECRET` — Webhook HMAC verification

### Functions

| Function | Description |
|----------|-------------|
| `isGitHubConfigured()` | Returns true if `GITHUB_TOKEN` is set |
| `validateRepo(owner, repo)` | Validates repository exists and is accessible. Returns `{ valid, repo: { fullName, defaultBranch, url, private } }` |
| `getRepoCommits(owner, repo, branch, limit)` | Fetches recent commits. Returns `{ commits: [{ sha, shortSha, message, author, date, url }] }` |
| `getRepoBranches(owner, repo)` | Lists branches. Returns `{ branches: [{ name, protected }] }` |

### Webhook (`/api/webhooks/github`)
- **Verification:** HMAC-SHA256 using `GITHUB_WEBHOOK_SECRET` (`x-hub-signature-256` header)
- **Events handled:**
  - `push`: Updates `project_repos.last_synced_at`, logs activity

### Vercel Webhook (`/api/webhooks/vercel`)
- **Verification:** HMAC-SHA1
- **Events handled:**
  - `deployment.ready`: Auto-creates demo record from Vercel deployment URL

---

## Resend (Email)

**File:** `src/lib/email/client.js`
**SDK:** `resend`

### Configuration
- `RESEND_API_KEY` — Resend API key
- `EMAIL_FROM` — Sender address (default: `Botmakers CRM <noreply@botmakers.ai>`)

### Function

```javascript
sendEmail({ to, subject, html, from })
// Returns: { success: true, id } or { success: false, error }
```

Handles errors gracefully (returns error object, never throws).

### Email Templates (`src/lib/email/templates.js`)

All templates use `wrapInBrandedTemplate(content)` for consistent branding.

| Template | Triggered By |
|----------|-------------|
| `welcomeClient(client)` | Lead-to-client conversion |
| `portalInvite(client, projects, portalUrl)` | Portal invite sent |
| `proposalSent(proposal, client, portalUrl)` | Proposal sent to client |
| `invoiceSent(invoice, client, paymentUrl)` | Invoice sent to client |
| `paymentReceipt(invoice, payment, client)` | Payment received |

### Notification Templates (`src/lib/email/notifications.js`)

| Function | Triggered By |
|----------|-------------|
| `newLeadAlert(lead)` | New lead created |
| `leadStageChange(lead, oldStage, newStage)` | Pipeline stage change |
| `proposalAccepted(proposal, client)` | Client accepts proposal |
| `paymentReceived(invoice, payment)` | Square webhook payment |
| `clientQuestion(question, project, client)` | Client submits question |
| `milestoneOverdue(milestone, project)` | Cron: overdue detection |
| `staleLeadAlert(leads)` | Cron: stale lead detection |
| `milestoneCompletedEmail(milestone, project)` | Milestone marked complete |
| `questionRepliedEmail(question, project)` | Team replies to question |

---

## Claude AI (Anthropic)

**File:** `src/lib/ai/client.js`
**SDK:** `@anthropic-ai/sdk`
**Model:** `claude-sonnet-4-5-20250929`

### Configuration
- `ANTHROPIC_API_KEY` — Anthropic API key

### Functions

| Function | Max Tokens | Description |
|----------|-----------|-------------|
| `analyzeLeadWithAI(leadData)` | 1024 | Analyzes lead prospect. Returns `{ score, prospect_summary, project_summary, complexity, estimated_effort, key_questions, red_flags, recommended_next_step }` |
| `generateProposalWithAI({ leadData, discoveryNotes, pricingType })` | 4096 | Generates proposal content. Returns `{ title, scope_of_work, deliverables, terms_and_conditions, suggested_line_items }` |
| `generateEmailWithAI({ recipientName, category, tone, ... })` | 2048 | Generates email. Returns `{ subject, body_html, body_text }` |
| `generateFollowUpEmail({ leadName, company, pipelineStage, triggerReason, lastInteraction })` | 1024 | Generates follow-up email for reminders. Returns `{ subject, body_html, body_text }` |
| `polishReplyWithAI({ question, draft, projectName })` | 1024 | Polishes team reply to client question. Returns polished text |

### System Prompts (`src/lib/ai/prompts.js`)

| Prompt Constant | Used By |
|----------------|---------|
| `LEAD_ANALYSIS_SYSTEM_PROMPT` | Lead analysis |
| `PROPOSAL_GENERATION_PROMPT` | Proposal generation |
| `EMAIL_GENERATION_PROMPT` | Email generation (9 categories) |
| `FOLLOW_UP_EMAIL_PROMPT` | Follow-up emails |
| `REPLY_POLISH_PROMPT` | Question reply polishing |

### JSON Parsing
`safeParseJSON(text)` — Strips markdown code fences that Claude sometimes adds before parsing JSON.

---

## Upstash (Rate Limiting)

**SDK:** `@upstash/ratelimit` + `@upstash/redis`

### Configuration
- `UPSTASH_REDIS_REST_URL` — Redis URL
- `UPSTASH_REDIS_REST_TOKEN` — Redis token

### Usage

| Location | Limit | Window |
|----------|-------|--------|
| `/api/auth/sign-in` | 5 requests | 15 minutes (per IP) |
| `/portal/login` (magic link) | 3 requests | 1 hour (per email) |
| `sendPortalInvite` | 3 invites | 24 hours (per client) |

---

## In-App Notifications

**File:** `src/lib/notifications/notify.js`

### Functions

| Function | Description |
|----------|-------------|
| `sendTeamNotification({ type, title, body, link, excludeUserId })` | Sends in-app notification to ALL active team members + email |
| `sendUserNotification({ userId, type, title, body, link })` | Sends to ONE specific team member + email |
| `getUnreadNotifications(userId, limit)` | Gets unread notifications |
| `getNotificationCount(userId)` | Gets unread count |
| `markNotificationRead(notificationId, userId)` | Marks single as read |
| `markAllNotificationsRead(userId)` | Marks all as read |

### Notification Types

| Type | Trigger | Icon |
|------|---------|------|
| `pipeline_move` | Lead stage change | swap-horizontal |
| `proposal_viewed` | Proposal viewed by client | eye |
| `proposal_signed` | Proposal accepted | check-decagram |
| `lead_assigned` | Lead assigned to member | account-arrow-right |
| `milestone_completed` | Milestone completed | flag-checkered |
| `project_completed` | Project completed | folder-check |
| `demo_approved` | Demo approved for portal | monitor-share |
| `client_question` | Client asks question | chat-question |
| `follow_up_reminder` | Follow-up is due | bell-ring |

### NotificationBell Component
- Header component that polls `/api/notifications` every 30 seconds
- Shows unread count badge
- Dropdown with recent notifications
- Click to navigate + mark as read
- "Mark all read" button
