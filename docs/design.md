# Design System

## Branding

| Token | Value | Usage |
|-------|-------|-------|
| **Primary** | `#033457` (Navy) | Backgrounds, headers, primary buttons, sidebar |
| **Accent** | `#03FF00` (Neon Green) | Active states, CTAs, success, completed items |
| **Accent Hover** | `#02cc00` | Green button hover |
| **Blue** | `#1E40AF` | Secondary accent |
| **Font** | Inter Tight | All text, weights 100-900 |
| **Theme** | Dark only | No light/dark toggle |

---

## Color Palette

### Status Colors (Pipeline Stages)

| Stage | Color | Hex |
|-------|-------|-----|
| New Lead | Gray | `#6c757d` |
| Contacted | Cyan | `#0dcaf0` |
| Discovery Scheduled | Blue | `#0d6efd` |
| Discovery Completed | Purple | `#6610f2` |
| Proposal Sent | Violet | `#6f42c1` |
| Negotiation | Orange | `#fd7e14` |
| Contract Signed | Yellow | `#ffc107` |
| Active Client | Green | `#198754` |
| Project Delivered | Neon Green | `#03FF00` |
| Retention | Navy | `#033457` |

### Status Colors (Entities)

| Status | Color | Used In |
|--------|-------|---------|
| Draft | `#6c757d` (Gray) | Projects, Proposals, Invoices |
| In Progress | `#0d6efd` (Blue) | Projects, Milestones |
| Paused | `#ffc107` (Yellow) | Projects |
| Completed | `#198754` (Green) | Projects, Milestones |
| Cancelled | `#dc3545` (Red) | Projects, Invoices |
| Sent | `#0dcaf0` (Cyan) | Proposals, Invoices |
| Viewed | `#0d6efd` (Blue) | Proposals, Invoices |
| Accepted | `#198754` (Green) | Proposals |
| Declined | `#dc3545` (Red) | Proposals |
| Expired | `#6c757d` (Gray) | Proposals |
| Paid | `#198754` (Green) | Invoices |
| Overdue | `#dc3545` (Red) | Invoices, Milestones |

### Lead Score Colors

| Score | Color |
|-------|-------|
| High | `#198754` (Green) |
| Medium | `#ffc107` (Yellow) |
| Low | `#dc3545` (Red) |

### Semantic Colors

| Purpose | Color |
|---------|-------|
| Success | `#198754` |
| Warning | `#ffc107` |
| Danger | `#dc3545` |
| Info | `#0dcaf0` |
| Muted | `#6c757d` |

---

## Typography

### Font

```css
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@100..900&display=swap');

* { font-family: 'Inter Tight', sans-serif !important; }
```

### Weights Used

| Weight | Class | Usage |
|--------|-------|-------|
| 400 | (default) | Body text |
| 500 | `.fw-medium` | Labels, secondary headings |
| 600 | `.fw-semibold` | Card headers, section headers |
| 700 | `.fw-bold` | Emphasis, large numbers |

### Sizes

| Class | Approx Size | Usage |
|-------|------------|-------|
| `.text-xs` | 12px | Metadata, timestamps, labels |
| `.text-sm` | 13-14px | Table text, descriptions |
| `.text-md` | 16px | Body text |
| `.text-lg` | 18px | Section headers |
| `.text-xl` | 20px | Page sub-headers |
| `.text-2xl` | 24px | Metric numbers |
| `h6` | 18px | Card/section headers |
| `h4` | 24px | Page headers |

### Text Colors

| Class | Usage |
|-------|-------|
| `.text-white` | Primary text on dark backgrounds |
| `.text-primary-light` | Secondary text, labels |
| `.text-secondary-light` | Muted text, timestamps |
| `.text-success-main` | Success states |
| `.text-warning-main` | Warning states |
| `.text-danger-main` | Error states |

---

## Dark Theme

### Enforcement

```jsx
// layout.jsx
<html lang='en' data-theme='dark'>
  <body className='dark'>

// MasterLayout.jsx useEffect
document.documentElement.setAttribute("data-theme", "dark");
```

- `[data-theme="dark"]` attribute on `<html>`
- `.dark` class on `<body>`
- ThemeToggleButton removed from MasterLayout
- No toggle anywhere in the UI
- CSS overrides use `!important` for critical colors

### Dark Theme Values

| Element | Styling |
|---------|---------|
| Body/Background | Dark gray (WowDash template default) |
| Cards | Dark with subtle borders |
| Text Primary | `--primary-light` (light gray/white) |
| Text Secondary | `--secondary-light` (muted gray) |
| Borders | `rgba(255,255,255,0.1)` or `border-secondary-subtle` |
| Form inputs | `.bg-base .text-white .border-secondary-subtle` |

---

## Portal (Light Theme)

Portal pages use `.portal-layout` class for light theme override.

| Element | Value |
|---------|-------|
| Background | `#f8f9fa` |
| Card Background | `#ffffff` |
| Text Primary | `#333333` |
| Text Secondary | `#6c757d` |
| Borders | `#e9ecef`, `#dee2e6` |
| Header Background | `#033457` (Navy) |
| Header Text | `#ffffff` |
| Focus Ring | Navy border with rgba shadow |

---

## Component Patterns

### Cards

```jsx
<div className="card">
  <div className="card-header border-bottom">
    <h6 className="text-lg fw-semibold mb-0">Title</h6>
  </div>
  <div className="card-body">
    {content}
  </div>
</div>
```

### Status Badges

Color wash pattern: 20% opacity background + full color text.

```jsx
<span
  className="badge fw-medium text-xs"
  style={{
    background: `${statusColor}22`,
    color: statusColor,
  }}
>
  {statusLabel}
</span>
```

### Buttons

| Type | Classes |
|------|---------|
| Primary (Navy) | `btn btn-primary` |
| Accent (Green) | `btn-crm-accent` (custom) |
| Outline | `btn btn-outline-secondary` |
| Small | `btn btn-sm` |
| With icon | `d-flex align-items-center gap-1` |

### Form Controls

```jsx
<input className="form-control bg-base text-white border-secondary-subtle" />
<select className="form-select bg-base text-white border-secondary-subtle" />
```

### Search Input Group

```jsx
<div className="input-group">
  <span className="input-group-text bg-base text-secondary-light border-secondary-subtle">
    <Icon icon="mdi:magnify" />
  </span>
  <input className="form-control bg-base text-white border-secondary-subtle" />
</div>
```

### Progress Bars

```jsx
<div className="progress" style={{ height: '6px', background: 'rgba(255,255,255,0.1)' }}>
  <div
    className="progress-bar"
    style={{ width: `${progress}%`, background: progress === 100 ? '#198754' : '#03FF00' }}
  />
</div>
```

### Tables

```jsx
<table className="table text-sm">
  <thead>
    <tr className="text-secondary-light text-xs">
      <th>Column</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td className="text-white text-sm fw-medium">{data}</td>
    </tr>
  </tbody>
</table>
```

---

## Icons

**Library:** `@iconify/react` (supports multiple icon sets)

### Sidebar Navigation

| Page | Icon |
|------|------|
| Dashboard | `solar:home-smile-angle-outline` |
| Pipeline | `mage:dashboard-2` |
| Leads | `gridicons:multiple-users` |
| Referrals | `mdi:account-group-outline` |
| Clients | `mdi:account-tie` |
| Projects | `solar:folder-with-files-outline` |
| Proposals | `mdi:file-document-edit-outline` |
| Invoices | `mdi:receipt-text-outline` |
| Email Generator | `solar:letter-outline` |
| Settings | `solar:settings-outline` |
| Activity Log | `mdi:history` |

### UI Icons

| Purpose | Icon |
|---------|------|
| Menu toggle | `heroicons:bars-3-solid` |
| Close | `radix-icons:cross-2` |
| Logout | `lucide:power` |
| External link | `mdi:open-in-new` |
| Search | `mdi:magnify` |
| Add | `mdi:plus` |
| Email | `mdi:email-outline` |
| Phone | `mdi:phone-outline` |
| Calendar | `mdi:calendar-outline` |
| Eye/View | `mdi:eye-outline` |
| Alert | `solar:alarm-bold` |
| Check circle | `mdi:check-circle` |
| Danger | `mdi:alert-circle` |

### Icon Sizing

```jsx
<Icon icon="..." style={{ fontSize: '16px' }} />  // inline
<Icon icon="..." className="text-xl" />            // via class
```

Common sizes: 16px (inline), 18px (list items), 20px (buttons), 48px (empty states)

---

## Layout Structure

### MasterLayout (CRM)

```
┌─────────────────────────────────────────────────────┐
│ Header: [Toggle] .................. [Bell] [Avatar] │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │ Main Content Area                        │
│          │                                          │
│ Logo     │ .dashboard-main-body                     │
│ ──────── │                                          │
│ Dashboard│                                          │
│ Pipeline │                                          │
│ Leads    │                                          │
│ Referrals│                                          │
│ Clients  │                                          │
│ Projects │                                          │
│ Proposals│                                          │
│ Invoices │                                          │
│ Email Gen│                                          │
│ ──────── │                                          │
│ Settings │                                          │
│ Activity │                                          │
│ ──────── │                                          │
│ Website↗ │                                          │
│ Logout   │ Footer: copyright                        │
└──────────┴──────────────────────────────────────────┘
```

- Sidebar collapses to icons on small desktop, full drawer on mobile
- Active sidebar link: neon green text (`#03FF00`)
- Header: sticky, NotificationBell component, user avatar dropdown

### PortalLayout (Client Portal)

```
┌─────────────────────────────────────────────────────┐
│ Header: [Logo] ........................... [Logout] │
│ (Admin preview banner if isPreview=true)            │
├─────────────────────────────────────────────────────┤
│                                                     │
│      Content (max-width: 960px, centered)           │
│      Light background (#f8f9fa)                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Footer: copyright                                   │
└─────────────────────────────────────────────────────┘
```

### Responsive Grid

| Breakpoint | Width | Columns |
|-----------|-------|---------|
| XS | <576px | 1 (full width) |
| SM | >=576px | 1-2 |
| MD | >=768px | 2 |
| LG | >=992px | 2-3 |
| XL | >=1200px | 3 |
| XXL | >=1400px | 4 |

Common patterns:
- **Metric cards:** `row-cols-xxl-4 row-cols-lg-2 row-cols-1`
- **Project cards:** `col-xl-4 col-lg-6 col-md-6`
- **Filter bar:** `col-lg-4` (search) + `col-lg-3` (dropdowns)

---

## PWA Configuration

### Manifests

**CRM** (`/manifest.json`):
```json
{
  "name": "Botmakers CRM",
  "short_name": "BM CRM",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#033457",
  "theme_color": "#033457",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192" },
    { "src": "/icons/icon-512.png", "sizes": "512x512" }
  ]
}
```

**Portal** (`/portal-manifest.json`):
```json
{
  "name": "Botmakers Portal",
  "short_name": "BM Portal",
  "start_url": "/portal",
  "display": "standalone",
  "background_color": "#f8f9fa",
  "theme_color": "#033457"
}
```

### Service Worker (`/sw.js`)

- **Cache name:** `bm-crm-v1`
- **Strategy:** Network-first with offline fallback
- **Cached assets:** `/offline.html`, icons
- **Skips:** `/api/*`, `/auth/*`, non-GET requests, non-HTTP URLs
- **Fallback:** Navigation requests serve `/offline.html` on network failure

### Offline Page (`/offline.html`)

- Navy background (`#033457`)
- WiFi-off SVG icon
- "You're Offline" heading
- Retry button (neon green)

### Install Banner (`PWASetup.jsx`)

- Fixed bottom-center, z-index 9999
- Navy background with white text
- App icon (36x36), title, green "Install" button
- Dismissible (stored in localStorage)
- Triggers on `beforeinstallprompt` event

### Icons

| File | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192x192 | Android, PWA |
| `icon-512.png` | 512x512 | Android splash, PWA |
| `apple-touch-icon.png` | 180x180 | iOS home screen |

### Meta Tags (layout.jsx)

```jsx
export const metadata = {
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Botmakers CRM" },
  other: { "mobile-web-app-capable": "yes" },
};
export const viewport = { themeColor: "#033457" };
// <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

Portal layout overrides manifest to `/portal-manifest.json`.

---

## Special Styling

### Rich Text Editor (ReactQuill)

```css
.ql-toolbar.ql-snow { border-color: rgba(255,255,255,0.1); }
.ql-container.ql-snow { border-color: rgba(255,255,255,0.1); }
.ql-editor { color: #e2e8f0; }
.ql-snow .ql-picker-options { background: #1a2332; }
```

### Proposal Content (rendered HTML)

```css
.proposal-content h3 { color: #fff; font-size: 16px; font-weight: 600; }
.proposal-content p { margin-bottom: 12px; line-height: 1.6; }
.proposal-content strong { color: #fff; }
```

### Email Templates

All emails use `wrapInBrandedTemplate(content)`:
- Max-width 600px, centered
- Navy header with logo
- White content area
- Navy footer with copyright
- Green CTA buttons

---

## CSS Files

| File | Purpose |
|------|---------|
| `src/app/globals.css` | Primary color overrides, portal theme, editor styles, lead sources table |
| `src/app/font.css` | Inter Tight import, global font-family |
| WowDash CSS | Bootstrap 5, template components (imported via PluginInit) |
