# Authentication & Authorization

## Overview

Two separate auth flows:
1. **Team (CRM):** Email/password via Supabase Auth
2. **Client (Portal):** Magic link (OTP) via Supabase Auth

Both use Supabase session cookies via `@supabase/ssr`, refreshed by middleware.

---

## Auth Helpers

**File:** `src/lib/auth/helpers.js`

All helpers use the Supabase admin client (PostgREST) instead of Drizzle to avoid `DATABASE_URL` issues. A `toCamel()` utility converts snake_case PostgREST rows to camelCase.

### `getSession()`
- Creates a server-side Supabase client from cookies
- Calls `supabase.auth.getUser()` to get the current user
- Returns `{ user }` or `{ user: null }`

### `getTeamUser()`
- Calls `getSession()` to get the authenticated user
- Queries `team_users` table via service role client (bypasses RLS)
- Matches on `team_users.email = user.email`
- Returns the team user record or `null`

### `getClientUser()`
- Calls `getSession()` to get the authenticated user
- Queries `clients` table via service role client
- Matches on `clients.auth_user_id = user.id`
- Returns the client record or `null`

### `requireTeam()`
- Calls `getTeamUser()`
- If not found, throws redirect to `/sign-in`
- Returns the team user record

### `requireAdmin()`
- Calls `requireTeam()`
- If `role !== 'admin'`, throws redirect to `/`
- Returns the admin team user record

### `requireClient()`
- Calls `getClientUser()`
- If not found, throws redirect to `/portal/login`
- Returns the client record

---

## Middleware

**File:** `src/middleware.js`

### Route Protection

| Route Pattern | Behavior |
|--------------|----------|
| `/sign-in` | Always accessible |
| `/portal/login` | Always accessible |
| `/portal/preview` | Always accessible (token-verified in page) |
| `/api/*` | No middleware checks |
| `/_next/*`, `/icons/*`, etc. | Static assets, no checks |
| `/portal/*` | Requires Supabase session, redirects to `/portal/login` if missing |
| All other routes | Requires Supabase session + `team_users` match, redirects to `/sign-in` if missing |

### Session Refresh
Middleware calls `supabase.auth.getUser()` on every request to refresh the session cookie. Uses service role client for the `team_users` check to bypass RLS circular policy.

---

## Team Sign-In Flow

1. User visits `/sign-in`
2. Enters email + password
3. Client-side `signInWithPassword()` via Supabase browser client
4. On success, middleware checks `team_users` table for the email
5. If not a team member, signs out and shows error
6. If valid, redirects to dashboard `/`

**Rate Limiting:** API route at `/api/auth/sign-in` uses Upstash rate limiter (5 attempts per 15 minutes per IP).

**Error Codes:**
- `CB-AUTH-001`: Invalid credentials
- `CB-AUTH-003`: Not a team member

---

## Portal Magic Link Flow

1. Client visits `/portal/login`
2. Enters email address
3. System validates email exists in `clients` table
4. Calls `signInWithOtp()` via Supabase admin client
5. Client receives magic link email
6. Clicking link authenticates and redirects to `/portal`
7. `requireClient()` matches `clients.auth_user_id` to session user

**Rate Limiting:** 3 magic link requests per hour per email address.

**Access Revocation:** If `clients.portal_access_revoked === true`, the portal home page signs out the user and redirects to `/portal/login?error=access_revoked`.

---

## Portal Invite System

When a client needs portal access:

1. Team member clicks "Send Portal Invite" on client detail
2. `sendPortalInvite(clientId)` server action:
   - Validates email exists
   - Checks for team email conflict
   - Rate limits: max 3 invites per 24 hours
   - Creates Supabase Auth user if needed (reuses `convertLeadToClient` pattern)
   - Sets `clients.auth_user_id`
   - Sends branded invite email with portal link
   - Updates: `portal_invited_at`, `portal_invite_count`, `portal_access_revoked = false`
   - Logs `portal.invite_sent` activity

### Access Management

| Action | Function | Effect |
|--------|----------|--------|
| Revoke | `revokePortalAccess(clientId)` | Sets `portal_access_revoked = true`, bans Auth user (`ban_duration: '876000h'`) |
| Restore | `restorePortalAccess(clientId)` | Sets `portal_access_revoked = false`, unbans Auth user (`ban_duration: 'none'`) |

### Auto-Invite Triggers
- **Proposal accepted:** If client has never been invited, `sendPortalInvite()` is called automatically (non-blocking)

---

## Admin Preview

Team members can preview the portal as a client without logging in as them.

1. Click "View as Client" on client detail page
2. `generatePortalPreviewToken(clientId)` creates an HMAC-SHA256 signed token:
   - Payload: `{ clientId, teamUserId, exp: 15min }`
   - Secret: `CRON_SECRET` env var
   - Format: `base64url(payload).base64url(signature)`
3. Opens `/portal/preview?token=...` in new tab
4. Server verifies token signature and expiry
5. Renders portal with `isPreview={true}` prop
6. Yellow admin banner: "Admin Preview -- Viewing as {name}"
7. Interactive elements (questions, accept proposal, pay) disabled in preview

---

## Login Tracking

When a client successfully accesses the portal:

1. `requireClient()` succeeds
2. Portal home page updates:
   - `portal_last_login_at = now()`
   - `portal_first_login_at = client.portal_first_login_at || now()`
3. Logs `portal.login` activity

---

## First-Time Welcome Walkthrough

1. After first login, if `portal_onboarding_complete === false`:
   - Redirect to `/portal/welcome`
2. 4-slide walkthrough:
   - Welcome + intro
   - Track Your Project
   - Stay Connected
   - Review & Approve
3. "Go to My Portal" or "Skip tour" calls `markOnboardingComplete()`
4. Sets `portal_onboarding_complete = true`
5. Redirects to `/portal`

---

## Row-Level Security (RLS)

Applied via `drizzle/0001_rls_policies.sql`:

- `team_users` table has RLS policies but they create circular issues with anon client
- All middleware and auth helper queries use the **service role client** to bypass RLS
- Portal queries use authenticated client sessions with appropriate policies

---

## Roles

| Role | Access |
|------|--------|
| **Admin** | Full CRM access, team management, settings, all integrations |
| **Member** | CRM access except team management and certain settings |
| **Client** | Portal only (own projects, proposals, invoices, questions) |

### Seed Users (3 admins)
- dessiah@botmakers.ai (Dessiah Daniel)
- jay@botmakers.ai (Jay)
- tdaniel@botmakers.ai (T. Daniel)
