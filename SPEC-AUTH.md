# SPEC-AUTH.md — Botmakers CRM v2

## Roles

### Admin (team)
Jay, Dad (Trent), Dee. Full CRM access. Email/password login at /sign-in.

### Team Member (future)
Schema-ready but not built in UI for v1. Same access as admin except cannot manage team or system settings.

### Client
Portal access via magic link at /portal/login. Can only see own data.

---

## Permission Matrix

| Resource | Admin | Client |
|----------|-------|--------|
| Leads — view/create/edit/delete | ✅ | ❌ |
| Referrals — view | ✅ | ❌ |
| Clients — view/create/edit | ✅ | Own only |
| Projects — view/create/edit | ✅ | Own only |
| Milestones — manage | ✅ | View only |
| Repos — manage | ✅ | ❌ |
| Demos — manage/approve | ✅ | View approved |
| Proposals — create/send/edit | ✅ | View/accept own |
| Invoices — create/send | ✅ | View/pay own |
| Questions — reply | ✅ | Submit/view own |
| Settings — manage | ✅ | ❌ |
| Activity log — view | ✅ | ❌ |

---

## Route Protection

| Route | Auth Required | Role | Redirect |
|-------|--------------|------|----------|
| /sign-in | No (redirect if authed) | — | → / if team |
| / (dashboard) | Team session | team_users | → /sign-in |
| /pipeline | Team session | team_users | → /sign-in |
| /leads, /leads/[id] | Team session | team_users | → /sign-in |
| /referrals | Team session | team_users | → /sign-in |
| /clients, /clients/[id] | Team session | team_users | → /sign-in |
| /projects, /projects/[id] | Team session | team_users | → /sign-in |
| /proposals, /proposals/[id] | Team session | team_users | → /sign-in |
| /invoices, /invoices/[id] | Team session | team_users | → /sign-in |
| /settings | Team session + admin | team_users | → /sign-in |
| /activity | Team session | team_users | → /sign-in |
| /portal/login | No (redirect if authed) | — | → /portal if client |
| /portal/* | Client session | clients | → /portal/login |
| /api/webhooks/* | Signature verification | — | 401 |
| /api/cron/* | CRON_SECRET header | — | 401 |

---

## Middleware Logic

```
middleware.js:
1. Get Supabase session from cookies
2. If path starts with CRM routes (/, /pipeline, /leads, etc.) except /sign-in:
   a. No session → redirect /sign-in
   b. Session exists → verify user in team_users table
   c. Not in team_users or is_active=false → redirect /sign-in
3. If path starts with /portal (except /portal/login):
   a. No session → redirect /portal/login
   b. Session exists → verify auth_user_id in clients table
   c. Not a client → redirect /portal/login
4. /sign-in with existing team session → redirect /
5. /portal/login with existing client session → redirect /portal
6. Refresh session token on every request
```

---

## RLS Policies (summary)

- **team_users:** team read, admin write
- **clients:** team all, client own (auth_user_id = auth.uid())
- **leads:** team only
- **referrers:** team only
- **contacts:** team only
- **proposals:** team all, client own non-draft
- **proposal_line_items:** follows proposal
- **projects:** team all, client own
- **project_phases, project_milestones:** follows project
- **project_repos:** team only
- **project_demos:** team all, client approved-only own
- **project_questions:** team all, client own
- **invoices, invoice_line_items, payments:** team all, client own
- **notifications, activity_log:** team only
- **system_settings:** team read, admin write

---

## Security Checklist

- Rate limit login: 5 per 15 min per IP
- Rate limit magic link: 3 per hour per email
- Service role key only in server-side code
- All input validated server-side (Zod)
- Webhook endpoints verify signatures
- Cron endpoints require CRON_SECRET
- Auth tokens in httpOnly cookies via @supabase/ssr
- Security headers in next.config.js
