# BUILD-STATE.md — Botmakers CRM v2

## Stage Progress

| # | Stage | Status | Notes |
|---|-------|--------|-------|
| 1 | Schema + env | ⬜ Pending | Drizzle schema, env validation, install deps |
| 2 | Auth + middleware | ⬜ Pending | Team login, client magic link, RLS |
| 3 | CRM shell | ⬜ Pending | Sidebar, layout, dark theme, routing |
| 4 | Dashboard | ⬜ Pending | Metrics, alerts, activity feed |
| 5 | Pipeline board | ⬜ Pending | Kanban, 10 stages, drag-and-drop |
| 6 | Leads | ⬜ Pending | List, detail, AI analysis, contacts |
| 7 | Clients + referrals | ⬜ Pending | Lead conversion, client management |
| 8 | Projects + milestones | ⬜ Pending | Phases, milestones, progress tracking |
| 9 | GitHub + Vercel | ⬜ Pending | Repo linking, commits, webhooks |
| 10 | Proposals + AI | ⬜ Pending | AI generation, client acceptance |
| 11 | Invoices + Square | ⬜ Pending | Square sync, payments, backfill |
| 12 | Portal + notifications + polish | ⬜ Pending | Client portal, cron, final sweep |
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
| GitHub Token | ⬜ Create during Stage 9 |
| Twilio | ⬜ Optional — waiting on Dad |
