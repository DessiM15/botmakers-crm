# PROJECT-SPEC.md — Botmakers CRM v2

## Project Overview

- **App Name:** Botmakers CRM
- **Domain:** crm.botmakers.ai (standalone, separate from botmakers.ai)
- **Owner:** BotMakers Inc. — Katy, Texas
- **Built by:** BotMakers Inc. (internal tool)
- **Template:** WowDash Next.js Admin Dashboard (Envato)

## Problem

BotMakers has no centralized system to manage the full client lifecycle. Leads arrive from 5 channels with no unified dashboard. Proposals are drafted ad-hoc. Project progress isn't connected to dev activity in GitHub/Vercel. Payments via Square aren't tracked alongside project status. Post-delivery follow-up falls through the cracks.

## Solution

A standalone CRM at crm.botmakers.ai that manages every stage from first contact to post-delivery retention. Built on the WowDash admin template for a polished, professional UI. Connected to the same Supabase project the website already uses, so leads flow in automatically.

## Architecture

- **Standalone repo** (`botmakers-crm`) — does NOT touch the botmakers.ai website
- **Same Supabase project** (`botmakers-intake`) — leads/referrals from the website are already there
- **Deployed to Vercel** at crm.botmakers.ai as a separate Vercel project
- **WowDash template** — Bootstrap 5, React 18, Next.js 15, JSX (not TypeScript)
- **Dark navy theme locked** — no light/dark toggle

## Roles

- **Admin (team):** Jay, Dad (Trent), Dee — full CRM access via email/password login
- **Team Member (future):** Added by admins with configurable permissions
- **Client:** Portal access via magic link. View own projects, accept proposals, pay invoices, submit questions
- **Visitor:** Only interacts with the main botmakers.ai website (not this app)

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** JavaScript (JSX) — matching WowDash template
- **UI:** WowDash template (Bootstrap 5 + custom CSS)
- **Icons:** @iconify/react (already in template)
- **Database:** Supabase (PostgreSQL + Auth + Storage) — existing project
- **ORM:** Drizzle ORM
- **Auth:** Supabase Auth (email/password for team, magic link for clients)
- **Email:** Resend
- **SMS:** Twilio (optional — graceful fallback)
- **AI:** Anthropic Claude API (@anthropic-ai/sdk)
- **Payments:** Square (Node SDK) — production, real account
- **VCS:** GitHub API (@octokit/rest)
- **Rate Limiting:** Upstash Redis (@upstash/ratelimit)
- **Deployment:** Vercel
- **Drag & Drop:** @hello-pangea/dnd (already in template)
- **Charts:** ApexCharts / react-apexcharts (already in template)
- **Date Picker:** react-datepicker (already in template)
- **Rich Text:** react-quill-new (already in template)
- **Toasts:** react-toastify (already in template)

## Branding

- **Primary:** #033457 (Navy)
- **Secondary:** #03FF00 (Green)
- **Accent:** #1E40AF (Blue — links/info)
- **Font:** Inter Tight
- **Theme:** Dark mode locked (no toggle)
- **Logo:** Botmakers logo (white/green on dark bg)

## Integrations — 6

1. **GitHub:** Attach repos to projects, view branch activity, commit history
2. **Vercel:** Auto-pull preview/deployment URLs as demo links
3. **Resend:** All email notifications (7 trigger types)
4. **Twilio:** SMS notifications (optional — graceful skip if not configured)
5. **Claude AI:** Lead analysis, proposal drafting, reply polishing
6. **Square (Production):** Real invoices, real checkout links, auto-invoice on milestones, payment webhooks, historical backfill

## Pipeline — 10 Stages

1. New Lead
2. Contacted
3. Discovery Call Scheduled
4. Discovery Call Completed
5. Proposal Sent
6. Negotiation / Follow-up
7. Contract Signed / Deposit Paid
8. Active Client
9. Project Delivered
10. Retention / Upsell

## Lead Sources — 5

Website form, referrals, Vapi AI calls (planned), cold outreach, word of mouth

## Notification Triggers — 7

1. New lead arrives
2. Lead moves pipeline stages
3. Proposal accepted by client
4. Payment received (Square webhook)
5. Client submits question
6. Milestone overdue
7. Stale lead (not contacted in X days)

## Build Stages — 12 (smaller, focused)

1. Project setup, Drizzle schema, env validation
2. Auth (team + client), middleware, RLS
3. CRM shell (sidebar, layout, dark theme, routing)
4. Dashboard (metrics, alerts, activity feed)
5. Pipeline board (Kanban, 10 stages, drag-and-drop)
6. Leads (list, detail, AI analysis, contact log)
7. Clients + lead conversion + referrals
8. Projects + milestones + phases
9. GitHub + Vercel integration
10. Proposals + AI generation + client acceptance
11. Invoices + Square integration + backfill
12. Client portal + notifications + cron + polish

## WowDash Components to Reuse

| Template Component | CRM Feature |
|---|---|
| MasterLayout (sidebar + header) | CRM shell — customize nav items |
| UnitCountOne (metric cards) | Dashboard metric cards |
| KanbanBoard + Column + TaskCard | Pipeline board |
| InvoiceListLayer | Invoice list |
| InvoiceAddLayer | Invoice creation |
| InvoicePreviewLayer | Invoice detail |
| InvoiceEditLayer | Invoice editing |
| UsersListLayer | Leads table, clients table |
| SignInLayer | Team login page |
| ViewDetailsLayer | Lead/client detail pages |
| TableDataLayer | Filterable data tables |
| CalendarMainLayer | Project timeline (future) |
| react-apexcharts | Dashboard charts |
| @hello-pangea/dnd | Pipeline drag-and-drop |
| react-quill-new | Proposal rich text editing |
| react-datepicker | Milestone due dates |
| react-toastify | Success/error toasts |
