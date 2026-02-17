# CLAUDE.md — Botmakers CRM v2

## Project Overview
Botmakers CRM is a standalone internal CRM at crm.botmakers.ai for BotMakers Inc. Built on the WowDash Next.js admin dashboard template (Envato). Manages leads, pipeline, proposals, projects (with GitHub/Vercel), billing (Square), and client portal. Connected to the same Supabase project as the main botmakers.ai website.

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** JavaScript (JSX) — NOT TypeScript. Match WowDash template patterns.
- **UI:** WowDash template — Bootstrap 5, custom CSS, @iconify/react icons
- **Database:** Supabase (PostgreSQL + Auth) — existing project `botmakers-intake`
- **ORM:** Drizzle ORM
- **Auth:** Supabase Auth (email/password team, magic link clients)
- **Email:** Resend
- **AI:** @anthropic-ai/sdk (claude-sonnet-4-5-20250929)
- **Payments:** Square (Node SDK) — PRODUCTION credentials
- **VCS:** @octokit/rest (GitHub API)
- **Rate Limiting:** @upstash/ratelimit + @upstash/redis
- **Existing template libs:** @hello-pangea/dnd, react-apexcharts, react-quill-new, react-datepicker, react-toastify, flatpickr

## CRITICAL RULES

### 1. Follow WowDash Patterns
- Use Bootstrap classes (NOT Tailwind)
- Use `className` with Bootstrap utilities: `d-flex`, `card`, `btn`, `form-control`, etc.
- Use `@iconify/react` Icon component for all icons
- Wrap all CRM pages in MasterLayout
- Follow the existing component pattern: page.jsx imports a Layer component, Layer does the rendering
- Keep files as .jsx (not .tsx)

### 2. Don't Break Existing Tables
- The `leads` and `referrers` tables exist from the live website
- NEVER drop or rename existing columns in these tables
- Only ADD new columns via ALTER TABLE
- All other tables can be dropped and recreated

### 3. Dark Theme Locked
- Remove ThemeToggleButton from MasterLayout
- Force dark mode CSS class on body
- No light/dark toggle anywhere
- Navy (#033457) primary, Green (#03FF00) accents

### 4. File Structure
```
src/
  app/
    sign-in/page.jsx           # Team login
    page.jsx                   # Dashboard (was index)
    pipeline/page.jsx          # Kanban board
    leads/
      page.jsx                 # Leads list
      [id]/page.jsx            # Lead detail
    referrals/page.jsx
    clients/
      page.jsx
      [id]/page.jsx
    projects/
      page.jsx
      new/page.jsx
      [id]/page.jsx
    proposals/
      page.jsx
      new/page.jsx
      [id]/page.jsx
    invoices/
      page.jsx
      new/page.jsx
      [id]/page.jsx
    settings/page.jsx
    activity/page.jsx
    portal/
      login/page.jsx
      page.jsx
      projects/[id]/page.jsx
      proposals/[id]/page.jsx
      invoices/
        page.jsx
        [id]/page.jsx
    api/
      webhooks/
        square/route.js
        github/route.js
        vercel/route.js
      cron/
        stale-leads/route.js
        overdue-milestones/route.js
      ai/
        analyze-lead/route.js
        generate-proposal/route.js
        polish-reply/route.js
  components/
    # Keep ALL existing WowDash components
    # Add new CRM components alongside them
    crm/                       # New CRM-specific components
      MetricCards.jsx
      AlertsPanel.jsx
      ActivityFeed.jsx
      PipelineBoard.jsx
      PipelineCard.jsx
      LeadTable.jsx
      LeadDetail.jsx
      ClientTable.jsx
      ProjectCard.jsx
      MilestoneEditor.jsx
      ProposalWizard.jsx
      InvoiceForm.jsx
      QuestionReply.jsx
      PortalProgressBar.jsx
      PortalMilestones.jsx
      PortalDemoGallery.jsx
      PortalQuestionForm.jsx
  lib/
    db/
      schema.js                # Drizzle schema
      client.js                # Supabase + Drizzle clients
      queries/                 # Query functions by domain
    auth/
      helpers.js               # getTeamUser, requireTeam, etc.
    actions/                   # Server actions by domain
    email/
      client.js                # Resend client
      templates.js             # HTML email template functions
    integrations/
      square.js
      github.js
      twilio.js
    ai/
      client.js                # Anthropic client
      prompts.js               # System prompts
    utils/
      formatters.js
      validators.js
      constants.js
    env.js                     # Env validation
  masterLayout/
    MasterLayout.jsx           # Customize sidebar nav
```

### 5. Coding Standards
- Every server action in try/catch with friendly error messages
- Toast on every mutation (success/error) using react-toastify
- Every list has empty state with CTA
- Every async button has loading spinner
- Every form disabled during submit
- Mobile responsive (template is already responsive, maintain it)
- No console.log in production code

### 6. Error Codes
- CB-AUTH-001: Invalid credentials
- CB-AUTH-002: Session expired
- CB-AUTH-003: Not team member
- CB-DB-001: Insert failed
- CB-DB-002: Record not found
- CB-API-001: Missing required field
- CB-API-003: Rate limit exceeded
- CB-INT-001: Resend email failed
- CB-INT-002: Claude API failed
- CB-INT-003: Square API failed
- CB-INT-004: GitHub API failed

## Branding
- Primary: #033457 (Navy)
- Secondary: #03FF00 (Green)
- Accent: #1E40AF (Blue)
- Font: Inter Tight
- Dark theme only
