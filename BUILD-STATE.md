# BUILD-STATE.md — Botmakers CRM v2

## Stage Progress

| # | Stage | Status | Notes |
|---|-------|--------|-------|
| 1 | Schema + env | ✅ Complete | Drizzle schema, env validation, install deps |
| 2 | Auth + middleware | ✅ Complete | Auth helpers, middleware, team sign-in, logout, RLS policies, seed users |
| 3 | CRM shell | ✅ Complete | MasterLayout sidebar, dark theme locked, placeholder pages, PortalLayout |
| 4 | Dashboard | ✅ Complete | Metrics, alerts, activity feed, greeting, quick actions |
| 5 | Pipeline board | ✅ Complete | Kanban board, 10 stage columns, drag-and-drop with server action, filter bar (source/score/assigned), PipelineCard + PipelineBoard components, leads query + updateLeadStage action |
| 6 | Leads | ✅ Complete | Leads list (search/filter/pagination/inline stage dropdown), lead detail (contact info, pipeline stage selector, AI analysis panel, notes auto-save, contact log timeline, log contact modal, assignment dropdown, actions), AI lead analysis (Claude API), analyze-lead API route, extended queries + server actions |
| 7 | Clients + referrals | ✅ Complete | Client list (search/pagination/add modal), client detail (tabbed: overview/projects/proposals/invoices/questions/activity, editable contact info, portal status), lead-to-client conversion (WF-4: creates client + auth account + welcome email + activity log), referrals page (expandable referrer rows with referred leads), email client (Resend), welcome email template |
| 8 | Projects + milestones | ✅ Complete | Projects list (card grid, search/filter), create project (form + editable phase template with 4 default phases/12 milestones), project detail (tabbed: overview/milestones/repos/questions/invoices), MilestoneEditor (accordion phases, status dropdowns, due dates, invoice triggers, add/remove phases+milestones, confirm dialogs), client detail Projects tab wired, project queries + server actions |
| 9 | GitHub + Vercel | ✅ Complete | GitHub integration (Octokit client, validateRepo, getRepoCommits, getRepoBranches), project detail Repos & Demos tab (link/unlink/sync repos, expandable commit history, add/delete/approve demos, auto-pulled badge), GitHub webhook (signature verify, push events, last_synced_at update), Vercel webhook (signature verify, deployment.ready, auto-pull demos), server actions (linkRepo, unlinkRepo, syncRepo, createDemo, deleteDemo, toggleDemoApproval), Settings page Integrations tab (GitHub/Vercel/Square/Resend status + webhook URLs) |
| 10 | Proposals + AI | ✅ Complete | Proposals list (search/filter/pagination), create proposal (3-step wizard: Context→Edit→Preview), AI proposal generation (Claude API, generate-proposal API route), ProposalDetail (status timeline, content sections, line items table, actions), send proposal (email + status update + lead pipeline stage change), proposal email template, ProposalWizard (lead/client selection, discovery notes, pricing type, ReactQuill rich text editors, line items with auto-calc), client detail Proposals tab wired, LeadDetail "Create Proposal" link, proposal queries + server actions |
| 11 | Invoices + Square | ✅ Complete | Square integration (create/send invoice, checkout links, list invoices/payments), invoices list (summary cards, search/filter/pagination), create invoice (form + line items + due date, save draft / send via Square / generate payment link), invoice detail (status timeline, line items, payment history, Square sync status, actions: send/remind/mark paid/payment link), Square webhook (HMAC verify, payment.completed + invoice.payment_made, idempotent payment recording, receipt email), milestone→invoice auto-creation (WF-7), Square backfill (import history), invoice email templates (sent + receipt), client detail Invoices tab wired, project detail Invoices tab wired, Settings Square section (status, environment, webhook URL, backfill button) |
| 12 | Portal + notifications + polish | ✅ Complete | Portal login (magic link, rate limited), portal home (project list/redirect), portal project view (progress bar, milestones, demos, Q&A), portal proposal view (read-only + accept & sign), portal invoices (list + detail + pay), notification system (7 email templates, branded HTML, notification logging), notifications wired to all flows (lead stage change, proposal accepted, payment received, client question, milestone completed), AI reply polish (api/ai/polish-reply + polishReplyWithAI), QuestionReply CRM component (draft/polish/send), cron jobs (stale-leads + overdue-milestones with CRON_SECRET), Settings page (Integrations + Team + Notifications tabs), Activity Log page (paginated + filtered feed), custom 404 page (branded) |
| — | Email Generator | ✅ Complete | AI-powered email drafting for leads/clients/prospects. Recipient search (leads+clients+manual entry), 9 template categories (incl. holidays), 3 tone options, Claude AI generation, rich text editor (react-quill-new), HTML preview toggle, copy HTML/text, send via Resend (info@botmakers.ai), save/load/delete drafts, activity log + contacts log on send, email_drafts table + RLS, sidebar nav item |
| — | Bug sweep | ⬜ Pending | |
| — | Staff review | ⬜ Pending | |

## Credentials Status

| Service | Status |
|---------|--------|
| Supabase | ✅ Ready |
| Resend | ✅ Ready |
| Anthropic | ✅ Ready |
| Upstash | ✅ Ready |
| Square (Production) | ✅ Ready |
| GitHub Token | ⬜ Add to .env.local when ready |
| Twilio | ⬜ Optional — waiting on Dad |
