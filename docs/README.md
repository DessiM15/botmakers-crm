# Botmakers CRM v2 — Full Specification

> **As-built documentation** for crm.botmakers.ai
> Last updated: February 2026

## Overview

Botmakers CRM is a standalone internal CRM at **crm.botmakers.ai** for BotMakers Inc. It manages the full sales pipeline from lead intake through project delivery and billing, with a client-facing portal for transparency. Built on the WowDash Next.js admin dashboard template (Envato), connected to the same Supabase project as the main botmakers.ai website.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | JavaScript (JSX) — no TypeScript |
| **UI** | WowDash template, Bootstrap 5, custom CSS, @iconify/react |
| **Database** | Supabase (PostgreSQL + Auth) — project `botmakers-intake` |
| **ORM** | Drizzle ORM |
| **Auth** | Supabase Auth (email/password for team, magic link for clients) |
| **Email** | Resend |
| **AI** | @anthropic-ai/sdk (Claude Sonnet 4.5) |
| **Payments** | Square (Node SDK) — PRODUCTION credentials |
| **VCS** | @octokit/rest (GitHub API) |
| **Rate Limiting** | @upstash/ratelimit + @upstash/redis |
| **Drag & Drop** | @hello-pangea/dnd |
| **Rich Text** | react-quill-new |
| **Charts** | react-apexcharts |
| **Date Pickers** | react-datepicker, flatpickr |
| **Toasts** | react-toastify |

## Documentation Index

| Document | Description |
|----------|-------------|
| [Data Model](./data-model.md) | 22 database tables, 11 enums, relationships, migration history |
| [Authentication](./auth.md) | Auth flows, middleware, roles, session management |
| [Pages & Components](./pages.md) | 26 pages, 40+ components, navigation flows |
| [API & Server Actions](./api.md) | API routes, 50+ server actions, webhooks, cron jobs |
| [Integrations](./integrations.md) | Square, GitHub, Resend, Claude AI, Upstash |
| [Workflows](./workflows.md) | Business logic flows, automations, pipeline transitions |
| [Design System](./design.md) | Branding, colors, typography, icons, PWA, dark theme |

## Project Structure

```
Botmakers CRM/
  CLAUDE.md                    # Build instructions
  BUILD-STATE.md               # Build progress tracker
  PROJECT-SPEC.md              # Original project spec
  SPEC-*.md                    # Domain specs (auth, data model, pages, workflows)
  docs/                        # This specification folder
  file/                        # Next.js application root
    .env.local                 # Environment variables
    package.json
    drizzle.config.js
    drizzle/                   # SQL migration scripts
    public/
      manifest.json            # CRM PWA manifest
      portal-manifest.json     # Portal PWA manifest
      sw.js                    # Service worker
      offline.html             # Offline fallback page
      icons/                   # PWA icons (192, 512, apple-touch)
    src/
      app/                     # Next.js App Router pages
        layout.jsx             # Root layout (dark theme, PWA meta)
        page.jsx               # Dashboard
        sign-in/               # Team login
        pipeline/              # Kanban board
        leads/                 # Lead list + detail
        referrals/             # Referral tracking
        clients/               # Client list + detail
        projects/              # Project list + create + detail
        proposals/             # Proposal list + wizard + detail
        invoices/              # Invoice list + create + detail
        email-generator/       # AI email drafting
        settings/              # Integrations, team, notifications
        activity/              # Activity log
        portal/                # Client portal (login, home, projects, proposals, invoices, welcome, preview)
        api/                   # API routes (webhooks, cron, AI, notifications)
      components/
        crm/                   # CRM-specific components (40+ files)
        shared/                # Shared components (PWASetup)
      lib/
        db/                    # Schema, client, queries/
        auth/                  # Auth helpers
        actions/               # Server actions by domain
        email/                 # Resend client + HTML templates
        notifications/         # In-app notification system
        integrations/          # Square, GitHub
        ai/                    # Anthropic client + prompts
        utils/                 # Formatters, validators, constants
        env.js                 # Environment variable validation
      masterLayout/            # MasterLayout (sidebar + header)
      middleware.js            # Route protection
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Transaction Pooler) |
| `ANTHROPIC_API_KEY` | Yes | Claude AI API key |
| `RESEND_API_KEY` | Yes | Resend email API key |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis token |
| `CRON_SECRET` | Yes | Secret for cron job auth + HMAC tokens |
| `SQUARE_ACCESS_TOKEN` | Optional | Square payment processing |
| `SQUARE_ENVIRONMENT` | Optional | `production` or `sandbox` |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Optional | Square webhook verification |
| `GITHUB_TOKEN` | Optional | GitHub API access |
| `GITHUB_WEBHOOK_SECRET` | Optional | GitHub webhook verification |
| `NEXT_PUBLIC_SITE_URL` | Optional | Public URL for links in emails |
| `EMAIL_FROM` | Optional | Sender email (default: `noreply@botmakers.ai`) |

## Build & Run

```bash
cd file/
npm install --legacy-peer-deps
npm run build    # Production build
npm run dev      # Development server (port 3000)
```

## Deployment

- **Platform:** Vercel
- **Branch:** `main` (auto-deploy)
- **Domain:** crm.botmakers.ai
- **Cron Jobs:** Configured in `vercel.json`
