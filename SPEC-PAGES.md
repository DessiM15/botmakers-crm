# SPEC-PAGES.md — Botmakers CRM v2

All pages use the WowDash MasterLayout (sidebar + header). Dark navy theme locked.

---

## CRM PAGES

### /sign-in — Team Login
- **Template base:** SignInLayer.jsx
- **Customize:** Remove social login buttons, remove sign-up link, add Botmakers logo, dark navy background
- **Fields:** Email, password
- **States:** Loading (button spinner), error (red text), rate limit message
- **After login:** Redirect to /

### / — Dashboard
- **Template base:** DashBoardLayerOne.jsx + UnitCountOne.jsx
- **Sections:**
  1. Greeting: "Good [morning/afternoon], [name]"
  2. Metric cards (4): Leads This Week, Pipeline Value, Active Projects, Revenue This Month
  3. Alerts panel: stale leads (orange), overdue milestones (red), pending questions (yellow)
  4. Recent activity feed (last 15 events)
  5. Quick actions: View Leads, New Project, Referrals, Projects
- **Empty:** "Welcome to Botmakers CRM!" with setup CTA

### /pipeline — Pipeline Board
- **Template base:** KanbanBoard.jsx + Column.jsx + TaskCard.jsx
- **Customize:** 10 columns (one per pipeline stage), lead cards with name/company/source/score/days
- **Drag-and-drop:** Move leads between stages (updates pipeline_stage)
- **Filters:** Source, score, assigned_to
- **Click card:** Navigate to /leads/[id]

### /leads — Leads List
- **Template base:** UsersListLayer.jsx or TableDataLayer.jsx
- **Columns:** Name (link), email, source (badge), score (badge), stage (dropdown), assigned, created
- **Features:** Search (debounced), filter dropdowns, pagination
- **Empty:** "No leads yet. They'll appear here when someone fills out the contact form."

### /leads/[id] — Lead Detail
- **Template base:** ViewDetailsLayer.jsx
- **Sections:**
  1. Header: name, company, stage badge, score badge, source badge
  2. Contact info card
  3. Pipeline stage visual selector (10 steps, click to change)
  4. AI Analysis panel (collapsible) — score, summary, complexity, red flags
  5. Notes textarea (auto-save on blur)
  6. Contact log timeline
  7. Actions: "Convert to Client" (green), "Create Proposal", "Log Contact" (modal)
  8. Assigned to dropdown

### /referrals — Referrals List
- **Template base:** TableDataLayer.jsx
- **Rows:** Referrer name, email, company, total referrals, date
- **Expandable:** Click to see referred leads with status

### /clients — Clients List
- **Template base:** UsersListLayer.jsx
- **Columns:** Name, company, email, projects (count), open invoices ($), last contact
- **Actions:** "Add Client" button

### /clients/[id] — Client Detail
- **Template base:** ViewDetailsLayer.jsx with tabs
- **Tabs:** Overview, Projects, Proposals, Invoices, Questions, Activity
- **Overview:** Editable contact info, notes, portal access status

### /projects — Projects List
- **Template base:** Card grid layout
- **Cards:** Name, client, status badge, progress bar, current phase, last activity

### /projects/new — Create Project
- **Form:** Name, client (dropdown), project type, description, pricing type, value, dates
- **Phase template:** Default 4 phases + 12 milestones, editable before creation

### /projects/[id] — Project Detail
- **Tabs:** Overview | Milestones | Repos & Demos | Questions | Invoices
- **Overview:** Info grid, status dropdown, progress bar, linked proposal
- **Milestones:** Collapsible phases, status dropdowns, due dates, invoice triggers, add/remove
- **Repos & Demos:** Link repo form, commit activity, add demo link, approve toggle
- **Questions:** Q&A list with reply + AI polish
- **Invoices:** Related invoices, "Create Invoice" button

### /proposals — Proposals List
- **Template base:** InvoiceListLayer.jsx (similar layout)
- **Columns:** Title, client, amount, status badge, sent date

### /proposals/new — Create Proposal
- **3-step wizard:**
  1. Context: select lead/client, paste discovery notes, pricing type
  2. "Generate with AI" → populates fields → edit scope/deliverables/terms (react-quill), line items
  3. Preview as client would see
- **Actions:** "Save Draft", "Send to Client"

### /proposals/[id] — Proposal Detail
- **Template base:** InvoicePreviewLayer.jsx (similar structure)
- **Status timeline:** Draft → Sent → Viewed → Accepted/Declined
- **Content:** Scope, deliverables, terms, line items
- **Actions:** Edit (if draft), Send, Create Project from Proposal

### /invoices — Invoices List
- **Template base:** InvoiceListLayer.jsx
- **Summary cards:** Total outstanding, paid this month, overdue count
- **Columns:** Title, client, project, amount, status, due date, paid date

### /invoices/new — Create Invoice
- **Template base:** InvoiceAddLayer.jsx
- **Form:** Client, project (optional), title, line items, due date
- **Actions:** "Save Draft", "Send via Square", "Generate Payment Link"

### /invoices/[id] — Invoice Detail
- **Template base:** InvoicePreviewLayer.jsx
- **Shows:** Content, Square sync status, payment history
- **Actions:** Send, Send Reminder, Mark Paid

### /email-generator — Email Generator
- **AI-powered email drafting** for leads, clients, and prospects
- **Recipient selector:** search leads + clients by name/email/company, or enter manually
- **Template categories:** Follow-Up, Introduction, Proposal Follow-Up, Check-In, Thank You, Project Update, Holiday Greeting (7 holidays), Win-Back, Referral Request
- **Tone selector:** Professional / Friendly / Casual
- **Custom instructions:** optional textarea for extra AI context
- **Generate button:** calls Claude API with recipient CRM history, returns subject + HTML body + plain text
- **Editor:** subject input (editable) + ReactQuill rich text editor + HTML code view toggle + email preview (collapsible)
- **Actions:** Copy HTML, Copy Plain Text, Save as Draft, Send from CRM (via Resend from info@botmakers.ai)
- **Drafts panel:** sidebar with saved drafts list, click to load, delete option
- **On send:** logs to activity_log + contacts table (type: email, direction: outbound)

### /settings — Settings
- **Tabs:** Team | Integrations | Notifications | Defaults
- **Team:** List members, invite form, deactivate toggle
- **Integrations:** GitHub token status, Square connection, Twilio status, Vercel webhook URL
- **Notifications:** Toggle events × channels, stale lead threshold
- **Defaults:** Default proposal terms, project phase template

### /activity — Activity Log
- **Template base:** TableDataLayer.jsx
- **Columns:** Icon, actor, action, entity link, timestamp
- **Filters:** Actor, action type, entity type, date range

---

## PORTAL PAGES

### /portal/login — Client Login
- **Light theme override** for portal pages
- **Email input → magic link**
- **Success:** "Check your email for a login link"
- **Error:** "No account found"

### /portal — Portal Home
- **Client's project list** (cards with progress bars)
- **If 1 project:** auto-redirect to /portal/projects/[id]
- **If 0:** "No active projects"

### /portal/projects/[id] — Client Project View
- **Progress bar** (animated green)
- **"What's Next"** — next 3 milestones
- **Milestone checklist** — grouped by phase, ✅ ● ○ icons
- **Demo gallery** — approved demos only
- **Q&A section** — submit question + history

### /portal/proposals/[id] — Client Proposal View
- **Read-only:** scope, deliverables, terms, pricing
- **Track view:** set viewed_at on first load
- **"Accept & Sign"** — modal with checkbox + signature input
- **States:** expired, already accepted, already declined

### /portal/invoices — Client Invoice List
- **Table:** Title, amount, status, due date, "Pay" button

### /portal/invoices/[id] — Client Invoice Detail
- **Content + line items**
- **"Pay Now"** → redirect to Square checkout URL
- **If paid:** "Paid on [date]"
