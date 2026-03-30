# BATCH 5: Global Search + CSV Exports + Dashboard Charts — Detailed Implementation Plan

## CONTEXT: What Exists Right Now

This is the Botmakers CRM (WowDash Next.js 15 template, Bootstrap 5, dark theme). All code lives in `file/` subdirectory.

Batches 1-4 completed: in-app notifications (25+ wired points), notification bell with real-time, notification center page (/notifications), user email preferences, calendar, meetings, dashboard redesign, portal invite system, PWA, and more.

**What's missing and highest impact:**
1. **Global Search** — No cross-entity search. Each list page has its own search bar, but there's no unified search across leads/clients/projects/proposals/invoices. No Cmd+K command palette.
2. **CSV Exports** — No export from any list. Users cannot download their data.
3. **Dashboard Charts** — `apexcharts` and `react-apexcharts` are already installed (package.json lines 26, 43) but NEVER used. Dashboard shows static metric cards only. No revenue trend chart, no lead funnel, no conversion charts.

---

## CURRENT INFRASTRUCTURE

| Component | File | Lines | Notes |
|-----------|------|-------|-------|
| MasterLayout | src/masterLayout/MasterLayout.jsx | ~200 | Header + sidebar, has NotificationBell + VoiceCommand |
| DashBoardLayer | src/components/crm/DashBoardLayer.jsx | 168 | Renders CompactMetrics, ActionCenter, TodaySchedule, etc. |
| Dashboard queries | src/lib/db/queries/dashboard.js | 393 | getMetrics, getAlerts, getRevenueMetrics, getLeadSourceAnalytics, etc. |
| Dashboard page | src/app/page.jsx | ~70 | Server component, 11 parallel queries |
| LeadTable | src/components/crm/LeadTable.jsx | 456 | Paginated list, search, filters |
| ClientTable | src/components/crm/ClientTable.jsx | 580 | Paginated list, search, add modal |
| InvoiceTable | src/components/crm/InvoiceTable.jsx | 328 | Summary cards + search + filter + pagination |
| ProposalList | src/components/crm/ProposalList.jsx | 302 | Table + search + filter + pagination |
| VoiceCommand | src/components/crm/VoiceCommand.jsx | ~340 | Ctrl+Shift+V voice/text command, existing Cmd palette for voice |
| package.json | package.json | 62 | Has apexcharts + react-apexcharts, NO papaparse/file-saver |

**Existing search patterns:** Each list component fetches its own data via server component props (server-side search via query params) or client-side fetch. There is no unified search API.

**API routes directory:**
```
src/app/api/
  ai/          — analyze-lead, generate-proposal, polish-reply
  auth/        — sign-in
  calendar/    — sync, events
  cron/        — stale-leads, overdue-milestones, follow-up-reminder, retention-cron, portal-invite-cron
  documents/   — file operations
  invoices/    — client-projects
  notifications/ — GET/POST + history + preferences
  projects/    — project-sync
  voice/       — command
  webhooks/    — square, github, vercel, calcom, new-lead
```

No `/api/search` route exists.

---

## BATCH 5 TASKS (Execute in This Order)

---

### TASK 1: Global Search API Route

**File:** Create `src/app/api/search/route.js`

This API performs a unified search across 5 entity types: leads, clients, projects, proposals, invoices. Each entity returns up to 5 results. The query searches by name, email, title, and relevant text fields.

```js
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getTeamUser } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { leads, clients, projects, proposals, invoices } from '@/lib/db/schema';
import { or, ilike, desc, sql } from 'drizzle-orm';

const MAX_PER_TYPE = 5;

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await getTeamUser(cookieStore);
    if (!teamUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const pattern = `%${q}%`;

    // Run all 5 searches in parallel
    const [leadResults, clientResults, projectResults, proposalResults, invoiceResults] = await Promise.all([
      db.select({
        id: leads.id,
        title: leads.fullName,
        subtitle: leads.email,
      })
        .from(leads)
        .where(or(ilike(leads.fullName, pattern), ilike(leads.email, pattern), ilike(leads.company, pattern)))
        .orderBy(desc(leads.createdAt))
        .limit(MAX_PER_TYPE),

      db.select({
        id: clients.id,
        title: clients.fullName,
        subtitle: clients.email,
      })
        .from(clients)
        .where(or(ilike(clients.fullName, pattern), ilike(clients.email, pattern), ilike(clients.company, pattern)))
        .orderBy(desc(clients.createdAt))
        .limit(MAX_PER_TYPE),

      db.select({
        id: projects.id,
        title: projects.name,
        subtitle: sql`NULL`,
      })
        .from(projects)
        .where(or(ilike(projects.name, pattern), ilike(projects.description, pattern)))
        .orderBy(desc(projects.createdAt))
        .limit(MAX_PER_TYPE),

      db.select({
        id: proposals.id,
        title: proposals.title,
        subtitle: sql`NULL`,
      })
        .from(proposals)
        .where(ilike(proposals.title, pattern))
        .orderBy(desc(proposals.createdAt))
        .limit(MAX_PER_TYPE),

      db.select({
        id: invoices.id,
        title: invoices.title,
        subtitle: sql`NULL`,
      })
        .from(invoices)
        .where(or(ilike(invoices.title, pattern), ilike(invoices.invoiceNumber, pattern)))
        .orderBy(desc(invoices.createdAt))
        .limit(MAX_PER_TYPE),
    ]);

    const results = [
      ...leadResults.map(r => ({ ...r, type: 'lead', link: `/leads/${r.id}` })),
      ...clientResults.map(r => ({ ...r, type: 'client', link: `/clients/${r.id}` })),
      ...projectResults.map(r => ({ ...r, type: 'project', link: `/projects/${r.id}` })),
      ...proposalResults.map(r => ({ ...r, type: 'proposal', link: `/proposals/${r.id}` })),
      ...invoiceResults.map(r => ({ ...r, type: 'invoice', link: `/invoices/${r.id}` })),
    ];

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
```

**IMPORTANT:** Check the actual column names in `schema.js` for each table before implementing. The `leads` table might use `full_name` vs `fullName`, and `invoices` might not have an `invoiceNumber` column. Verify:
- `leads`: fullName, email, company columns
- `clients`: fullName, email, company columns
- `projects`: name, description columns
- `proposals`: title column
- `invoices`: title, invoiceNumber columns

Adjust the query columns as needed based on actual schema.

---

### TASK 2: Global Search Command Palette Component

**File:** Create `src/components/crm/GlobalSearch.jsx`

A Cmd+K (Mac) / Ctrl+K (Windows) command palette. Opens as a modal overlay with:
- Search input with auto-focus
- Real-time results as you type (debounced 300ms)
- Results grouped by entity type with icons
- Keyboard navigation (up/down arrows, Enter to select)
- Click or Enter navigates to the entity and closes the palette

```
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
```

**Component structure:**
1. **Overlay**: Fixed position, full viewport, semi-transparent backdrop, z-index 2000
2. **Modal**: Centered, max-width 560px, dark background (#111b2e), rounded, border
3. **Search input**: Full-width, icon prefix (mdi:magnify), placeholder "Search leads, clients, projects...", auto-focus on open
4. **Results area**: Scrollable, max-height 400px, grouped by type with section headers
5. **Entity type icons**: Use these mappings:
   - lead: `mdi:account-star-outline`, color `#03FF00`
   - client: `mdi:account-tie`, color `#198754`
   - project: `solar:folder-with-files-outline`, color `#0dcaf0`
   - proposal: `mdi:file-document-edit-outline`, color `#0d6efd`
   - invoice: `mdi:receipt-text-outline`, color `#ffc107`
6. **Empty states**: "Type to search..." when empty, "No results found" when search returns nothing
7. **Loading**: Small spinner in the input area during fetch

**Keyboard handling:**
- `Cmd+K` or `Ctrl+K` → open palette (add event listener on window)
- `Escape` → close palette
- `ArrowUp` / `ArrowDown` → navigate results (track selectedIndex in state)
- `Enter` → navigate to selectedIndex result's link
- Typing → debounced fetch to `/api/search?q=...`

**Styling rules (Bootstrap, dark theme, NO Tailwind):**
- Backdrop: `position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2000`
- Modal: `background: #111b2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.5)`
- Input: `form-control bg-transparent text-white border-0` with custom padding for icon
- Section headers: `text-secondary-light text-xs text-uppercase fw-medium` with letter-spacing
- Result rows: `d-flex align-items-center gap-3 px-3 py-2` with hover highlight `rgba(255,255,255,0.04)`
- Selected row (keyboard): `background: rgba(3,52,87,0.5)` (navy tint)

---

### TASK 3: Wire GlobalSearch into MasterLayout

**File:** Update `src/masterLayout/MasterLayout.jsx`

Step 1 — Add import:
```js
import GlobalSearch from '@/components/crm/GlobalSearch';
```

Step 2 — Render the GlobalSearch component. Add it inside the layout, after the RealtimeNotificationProvider, before `{children}`. The GlobalSearch is a portal-like overlay that renders at the top level.

Find the location in MasterLayout where the main content area begins (the children render area). Add `<GlobalSearch />` at the same level.

Step 3 — Optionally add a search icon button in the header bar (next to NotificationBell) that opens the palette. The button should dispatch a custom event or call a function. But Cmd+K is the primary trigger, so the button is a nice-to-have.

---

### TASK 4: CSV Export Utility

**File:** Create `src/lib/utils/csv-export.js`

A client-side utility that converts an array of objects to CSV and triggers a download. No external dependencies needed (no papaparse).

```js
/**
 * Convert array of objects to CSV string.
 * Handles commas, quotes, and newlines in values.
 */
export function arrayToCSV(data, columns) {
  if (!data || data.length === 0) return '';

  const headers = columns.map(c => c.label);
  const rows = data.map(row =>
    columns.map(c => {
      let val = c.accessor ? c.accessor(row) : row[c.key] ?? '';
      val = String(val);
      // Escape quotes and wrap if contains comma, quote, or newline
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    })
  );

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Trigger browser download of a CSV file.
 */
export function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

---

### TASK 5: CSV Export API Routes

We need server-side export endpoints that return ALL data (not paginated) for a given entity. The client components will call these and then use the CSV utility to generate the file.

**File:** Create `src/app/api/export/leads/route.js`

```js
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const rows = await db
      .select({
        id: leads.id,
        fullName: leads.fullName,
        email: leads.email,
        phone: leads.phone,
        company: leads.company,
        source: leads.source,
        pipelineStage: leads.pipelineStage,
        leadScore: leads.leadScore,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .orderBy(desc(leads.createdAt))
      .limit(5000);

    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
```

**File:** Create `src/app/api/export/clients/route.js` — same pattern for clients table.
**File:** Create `src/app/api/export/invoices/route.js` — same pattern for invoices table (include line items total).
**File:** Create `src/app/api/export/proposals/route.js` — same pattern for proposals table.

**IMPORTANT:** Before writing these, check `schema.js` for the actual column names in each table. Use the columns that exist. Limit exports to 5000 rows max for safety.

---

### TASK 6: Add Export Buttons to List Components

Add an "Export CSV" button to each list component's header area.

**Files to modify:**
- `src/components/crm/LeadTable.jsx` — Add export button near the search bar
- `src/components/crm/ClientTable.jsx` — Add export button near the search bar
- `src/components/crm/InvoiceTable.jsx` — Add export button near the summary cards
- `src/components/crm/ProposalList.jsx` — Add export button near the search bar

**Pattern for each component:**

Step 1 — Add imports:
```js
import { arrayToCSV, downloadCSV } from '@/lib/utils/csv-export';
```

Step 2 — Add state:
```js
const [exporting, setExporting] = useState(false);
```

Step 3 — Add handler:
```js
const handleExport = async () => {
  setExporting(true);
  try {
    const res = await fetch('/api/export/leads');
    const { rows } = await res.json();
    const csv = arrayToCSV(rows, [
      { label: 'Name', key: 'fullName' },
      { label: 'Email', key: 'email' },
      { label: 'Phone', key: 'phone' },
      { label: 'Company', key: 'company' },
      { label: 'Source', key: 'source' },
      { label: 'Stage', key: 'pipelineStage' },
      { label: 'Score', key: 'leadScore' },
      { label: 'Created', accessor: (r) => new Date(r.createdAt).toLocaleDateString() },
    ]);
    downloadCSV(csv, `leads-export-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success('Export downloaded');
  } catch {
    toast.error('Export failed');
  }
  setExporting(false);
};
```

Step 4 — Add button to the header area (next to existing controls):
```jsx
<button className="btn btn-outline-secondary btn-sm" onClick={handleExport} disabled={exporting}>
  {exporting ? <span className="spinner-border spinner-border-sm me-1" /> : <Icon icon="mdi:download" className="me-1" style={{ fontSize: '16px' }} />}
  Export CSV
</button>
```

Repeat this pattern for clients, invoices, and proposals with their respective columns.

---

### TASK 7: Dashboard Revenue Chart

**File:** Create `src/components/crm/RevenueChart.jsx`

A line chart using react-apexcharts showing monthly revenue over the last 12 months. Uses data from the existing `getRevenueMetrics()` query (dashboard.js).

```
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });
```

**Chart configuration:**
- Type: `area` (filled line chart)
- Series: 2 lines — "Invoiced" and "Collected"
- X-axis: Month labels (Jan, Feb, Mar, etc.)
- Y-axis: Dollar amounts formatted with $ prefix
- Colors: `#0d6efd` (invoiced), `#03FF00` (collected)
- Dark theme: background transparent, grid lines rgba(255,255,255,0.05), text #6c757d
- Height: 300px
- Tooltip: Show $ amounts on hover
- Responsive: Shrinks on mobile

**ApexCharts options:**
```js
const options = {
  chart: {
    type: 'area',
    height: 300,
    background: 'transparent',
    toolbar: { show: false },
    fontFamily: 'Inter Tight, sans-serif',
  },
  colors: ['#0d6efd', '#03FF00'],
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  fill: {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 },
  },
  xaxis: {
    categories: monthLabels,
    labels: { style: { colors: '#6c757d', fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      formatter: (val) => '$' + (val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val),
      style: { colors: '#6c757d', fontSize: '11px' },
    },
  },
  grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
  legend: {
    position: 'top',
    horizontalAlign: 'right',
    labels: { colors: '#adb5bd' },
    fontSize: '12px',
  },
  tooltip: {
    theme: 'dark',
    y: { formatter: (val) => '$' + val.toLocaleString() },
  },
};
```

**Props:** Receives `monthlyRevenue` array from dashboard (already fetched by getRevenueMetrics).

**IMPORTANT:** Check what `getRevenueMetrics()` actually returns. Read `src/lib/db/queries/dashboard.js` and look at the `monthlyRevenue` array structure. The chart needs month labels and two series (invoiced/collected). If the query doesn't break down by invoiced vs collected, you may need to extend it.

---

### TASK 8: Dashboard Lead Funnel Chart

**File:** Create `src/components/crm/LeadFunnelChart.jsx`

A horizontal bar chart showing the lead funnel — how many leads are at each pipeline stage.

Uses data from `getMetrics()` or a new query that counts leads by stage.

**Chart type:** `bar` (horizontal)
**Series:** Single series with count per stage
**Categories:** Pipeline stage names (New, Contacted, Qualified, etc.)
**Colors:** Gradient from green (#03FF00) to navy (#033457) based on stage depth

**ApexCharts options:**
```js
const options = {
  chart: {
    type: 'bar',
    height: 280,
    background: 'transparent',
    toolbar: { show: false },
  },
  plotOptions: {
    bar: { horizontal: true, borderRadius: 4, barHeight: '60%' },
  },
  colors: ['#03FF00'],
  // ... similar dark theme config as RevenueChart
};
```

**IMPORTANT:** Check what pipeline stages exist. Read `src/lib/utils/constants.js` for the PIPELINE_STAGES array. The funnel should show all stages in order.

---

### TASK 9: Wire Charts into Dashboard

**File:** Update `src/components/crm/DashBoardLayer.jsx` (168 lines)

Currently the dashboard renders: CompactMetrics, ActionCenter (3 panels: Alerts, Upcoming, Follow-ups), TodaySchedule, and additional widgets.

Add the two new chart components below the CompactMetrics section.

Step 1 — Import charts:
```js
import RevenueChart from './RevenueChart';
import LeadFunnelChart from './LeadFunnelChart';
```

Step 2 — Add a new row with two columns (6+6 on desktop, 12 on mobile):
```jsx
<div className="row g-3 mb-4">
  <div className="col-lg-7">
    <div className="card h-100">
      <div className="card-header">
        <h6 className="text-white fw-semibold mb-0">Revenue Trend</h6>
      </div>
      <div className="card-body">
        <RevenueChart monthlyRevenue={revenue.monthlyRevenue} />
      </div>
    </div>
  </div>
  <div className="col-lg-5">
    <div className="card h-100">
      <div className="card-header">
        <h6 className="text-white fw-semibold mb-0">Lead Pipeline</h6>
      </div>
      <div className="card-body">
        <LeadFunnelChart />
      </div>
    </div>
  </div>
</div>
```

Step 3 — If the `revenue` prop doesn't have `monthlyRevenue`, check what props DashBoardLayer receives from the server component (page.jsx) and ensure the revenue data flows through.

**IMPORTANT:** Read DashBoardLayer.jsx first to understand its current layout. Don't break the existing component structure. Add the charts as a new row section.

**File:** Update `src/app/page.jsx` if needed to pass additional chart data.

If the lead funnel needs its own data (count per stage), either:
- Add a `getLeadsByStage` query that returns `[{ stage: 'new', count: 5 }, ...]`
- Or fetch this in the LeadFunnelChart component client-side via a new API route

Prefer server-side via page.jsx props for consistency.

---

### TASK 10: Lead Funnel API (if needed)

**File:** Create `src/app/api/dashboard/lead-funnel/route.js` (only if LeadFunnelChart needs client-side data)

```js
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const rows = await db
      .select({
        stage: leads.pipelineStage,
        count: sql`count(*)::int`,
      })
      .from(leads)
      .groupBy(leads.pipelineStage);

    return NextResponse.json({ stages: rows });
  } catch {
    return NextResponse.json({ stages: [] });
  }
}
```

---

### TASK 11: Build Verification

Run `npm run build` from `file/` directory. Fix any import errors, missing dependencies, or type issues.

Common issues to watch for:
- `react-apexcharts` must be loaded with `dynamic(() => import(...), { ssr: false })` since it uses `window`
- The `ilike` function from drizzle-orm may need import in the search route
- Column names in search/export queries must exactly match schema.js
- GlobalSearch keyboard listener must not conflict with VoiceCommand's Ctrl+Shift+V
- The CSV export utility is client-only (uses `document` and `URL.createObjectURL`)
- ApexCharts theme/colors must match the dark theme

---

### TASK 12: E2E Verification

After build passes:

1. **Global Search**: Press Cmd+K → palette opens → type "test" → results appear grouped by entity type → click result → navigates → palette closes → press Escape → palette closes
2. **CSV Export**: Go to /leads → click "Export CSV" → CSV file downloads → open in spreadsheet → data is correct
3. **Revenue Chart**: Go to Dashboard → Revenue Trend chart renders → hover shows tooltip → chart is responsive
4. **Lead Funnel**: Go to Dashboard → Lead Pipeline chart renders → shows stages with counts
5. **No regressions**: Bell still works, notifications page works, sidebar links work, all existing pages load

---

## IMPORTANT RULES TO FOLLOW

1. **WowDash/Bootstrap patterns** — NO Tailwind. Use Bootstrap classes, @iconify/react icons.
2. **Dark theme** — Navy (#033457) primary, green (#03FF00) accents. All charts use dark backgrounds.
3. **The file/ directory** — All Next.js code is in `file/`. Root has spec docs and CLAUDE.md.
4. **Read before editing** — Always read a file before modifying it. Check actual column names in schema.js.
5. **react-apexcharts SSR** — Must use `dynamic(() => import('react-apexcharts'), { ssr: false })` since ApexCharts needs `window`.
6. **CSV is client-side** — The `arrayToCSV` and `downloadCSV` functions run in the browser. The API routes just return JSON data.
7. **Export limits** — Cap at 5000 rows per export to prevent OOM.
8. **Search debounce** — 300ms debounce on the GlobalSearch input to avoid hammering the API.
9. **Keyboard conflicts** — Cmd+K for search, Ctrl+Shift+V for voice (already exists). These don't conflict.
10. **No new dependencies** — `apexcharts` and `react-apexcharts` are already installed. CSV export uses no external lib.
11. **Don't modify notification wiring** — This batch doesn't touch notifications, auth, or existing actions.
12. **Graceful degradation** — If no data exists (empty tables), charts should show "No data" or render empty gracefully.

---

## FILES REFERENCE

### NEW FILES:
```
src/app/api/search/route.js                    — Global search API
src/components/crm/GlobalSearch.jsx             — Cmd+K command palette
src/lib/utils/csv-export.js                     — CSV generation + download utility
src/app/api/export/leads/route.js               — Leads export API
src/app/api/export/clients/route.js             — Clients export API
src/app/api/export/invoices/route.js            — Invoices export API
src/app/api/export/proposals/route.js           — Proposals export API
src/components/crm/RevenueChart.jsx             — Revenue trend area chart
src/components/crm/LeadFunnelChart.jsx          — Lead pipeline horizontal bar chart
src/app/api/dashboard/lead-funnel/route.js      — Lead funnel data API (if needed)
```

### MODIFIED FILES:
```
src/masterLayout/MasterLayout.jsx               — Add GlobalSearch component
src/components/crm/LeadTable.jsx                — Add Export CSV button
src/components/crm/ClientTable.jsx              — Add Export CSV button
src/components/crm/InvoiceTable.jsx             — Add Export CSV button
src/components/crm/ProposalList.jsx             — Add Export CSV button
src/components/crm/DashBoardLayer.jsx           — Add chart components
src/app/page.jsx                                — Pass additional chart data (if needed)
```

---

## EXECUTION ORDER

Task 1 (search API) → Task 2 (search component) → Task 3 (wire into layout) → Task 4 (CSV utility) → Task 5 (export APIs) → Task 6 (export buttons) → Task 7 (revenue chart) → Task 8 (funnel chart) → Task 9 (wire charts into dashboard) → Task 10 (funnel API if needed) → Task 11 (build) → Task 12 (E2E)

Tasks 4-6 (CSV) are independent of Tasks 1-3 (Search) and Tasks 7-10 (Charts). These three groups can be developed in parallel within each group, but verification should be done after all are complete.
