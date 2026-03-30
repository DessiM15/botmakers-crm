# BATCH 4: Notification Center Page + User Notification Preferences — Detailed Implementation Plan

## CONTEXT: What Exists Right Now

This is the Botmakers CRM (WowDash Next.js 15 template, Bootstrap 5, dark theme). All code lives in `file/` subdirectory.

**Batches 1-3** (commit `2cec44a`) wired in-app notifications to every meaningful action in the system (25+ notification points). The notification bell (`NotificationBell.jsx`) in the header shows up to 10 unread notifications with icon/color per type (27 types mapped), mark-as-read, and a "View all activity" link that goes to `/activity`.

---

## TWO NOTIFICATION SYSTEMS (Critical — Review Before Coding)

1. **inAppNotifications table** (schema.js line 491) — Used by `src/lib/notifications/notify.js`. The `type` column is **plain text** (NOT enum-constrained). Any string works. Functions:
   - `sendTeamNotification({ type, title, body, link, excludeUserId })` — inserts row for ALL active team members + sends basic email to each (lines 32-64)
   - `sendUserNotification({ userId, type, title, body, link })` — inserts row for ONE user + sends email (lines 76-104)
   - `getUnreadNotifications(userId, limit)` — fetch unread (line 109)
   - `getNotificationCount(userId)` — unread count (line 121)
   - `markNotificationRead(id, userId)` — mark one read (line 132)
   - `markAllNotificationsRead(userId)` — mark all read (line 142)

2. **notifications table** (schema.js line 444) — Used by `src/lib/email/notifications.js`. The `type` column IS constrained by `notificationTypeEnum` (schema.js lines 93-118, 24 values). Functions send branded HTML emails + log to this table.

**Key rule**: `sendTeamNotification` handles in-app bell alerts + basic email. `sendNotification` (in notifications.js) handles branded email templates. Both are non-blocking (`.catch(() => {})`).

---

## CURRENT NOTIFICATION INFRASTRUCTURE

| Component | File | What It Does |
|-----------|------|--------------|
| **notify.js** | `src/lib/notifications/notify.js` (148 lines) | `sendTeamNotification`, `sendUserNotification`, `getUnread*`, `markRead*` |
| **Bell API** | `src/app/api/notifications/route.js` (62 lines) | GET: unread + count. POST: mark_read, mark_all_read |
| **NotificationBell** | `src/components/crm/NotificationBell.jsx` (301 lines) | Header bell icon, dropdown, polls every 30s, 27 icon/color mappings |
| **RealtimeProvider** | `src/components/crm/RealtimeNotificationProvider.jsx` (98 lines) | Subscribes to Supabase Realtime INSERT on `in_app_notifications`, dispatches `crm:new-notification` CustomEvent |
| **Schema** | `src/lib/db/schema.js` lines 491-500 | `inAppNotifications` table (id, userId, type, title, body, link, isRead, createdAt) |
| **Settings** | `src/components/crm/SettingsPage.jsx` (687 lines) | 5 tabs: Integrations, Team, Notifications (line 76), Calendar, Defaults |
| **Settings page** | `src/app/settings/page.jsx` (72 lines) | Server component, fetches settings, passes to SettingsPage |
| **Settings actions** | `src/lib/actions/settings.js` (130 lines) | `inviteTeamMember`, `toggleTeamMemberActive`, `saveSetting`, `saveCalendarColors` |

---

## WHAT ALREADY HAS NOTIFICATIONS (Don't Touch These)

Every CRM action now has in-app notifications wired. See Batch 3 completion summary for the complete list. **Do NOT modify any notification wiring in actions, webhooks, or cron files** — only modify `notify.js` to add preference checking.

---

## WHAT'S MISSING (This Batch Adds Both)

| Feature | Gap | Fix |
|---------|-----|-----|
| **Notification history** | Once read, notifications vanish from bell. No way to re-find a link | New `/notifications` page with paginated history |
| **User preferences** | Every team member gets every notification (in-app + email). No opt-out | New `notification_preferences` table, preference UI in Settings, check before email send |
| **Real-time bell** | `NotificationBell` polls every 30s but doesn't listen to `crm:new-notification` event from `RealtimeNotificationProvider` | Add event listener for instant bell updates |
| **No notification_preferences table** | Doesn't exist in DB or schema | Migration + Drizzle schema |

---

## BATCH 4 TASKS (Execute in This Order)

### TASK 1: Database Migration — notification_preferences Table

**File: Create `drizzle/0016_notification_preferences.sql`**

```sql
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES team_users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id);
```

**File: Create `scripts/run-migration-0016.mjs`** (copy pattern from `scripts/run-migration-0015.mjs`)

```javascript
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = postgres(databaseUrl, { prepare: false });

const statements = [
  `CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES team_users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, notification_type)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id)`,
];

for (const stmt of statements) {
  try {
    await sql.unsafe(stmt);
    console.log('OK:', stmt.substring(0, 70));
  } catch (e) {
    console.log('ERR:', e.message.substring(0, 100), '|', stmt.substring(0, 70));
  }
}

console.log('\nMigration 0016 complete.');
await sql.end();
process.exit(0);
```

**File: Update `src/lib/db/schema.js`** — Add the Drizzle table definition AFTER the `inAppNotifications` table (after line 500, before line 502 where `followUpReminders` starts):

```javascript
export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => teamUsers.id, { onDelete: 'cascade' }),
  notificationType: text('notification_type').notNull(),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Dependency**: Run migration before any code uses this table.

---

### TASK 2: Notification Preferences Query + Action

**File: Create `src/lib/db/queries/notification-preferences.js`**

```javascript
import { db } from '@/lib/db/client';
import { notificationPreferences } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Get all notification preferences for a user.
 * Returns a map: { [notificationType]: { emailEnabled } }
 * Missing types default to emailEnabled: true.
 */
export async function getUserPreferences(userId) {
  const rows = await db
    .select({
      notificationType: notificationPreferences.notificationType,
      emailEnabled: notificationPreferences.emailEnabled,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));

  const map = {};
  for (const row of rows) {
    map[row.notificationType] = { emailEnabled: row.emailEnabled };
  }
  return map;
}

/**
 * Check if a specific user has email enabled for a notification type.
 * Defaults to true if no preference is set.
 */
export async function isEmailEnabled(userId, notificationType) {
  const [pref] = await db
    .select({ emailEnabled: notificationPreferences.emailEnabled })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.notificationType, notificationType)
      )
    )
    .limit(1);

  // No preference saved = default to enabled
  if (!pref) return true;
  return pref.emailEnabled;
}
```

**File: Update `src/lib/actions/settings.js`** — Add import and new server action.

Step 1 — Add import at line 5 (after existing schema imports):
```javascript
import { notificationPreferences } from '@/lib/db/schema';
```

Step 2 — Add new function at the end of the file (after `saveCalendarColors`, after line 129):
```javascript
/**
 * Save notification preferences for the current team user.
 * @param {Array<{type: string, emailEnabled: boolean}>} prefs
 */
export async function saveNotificationPreferences(prefs) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    for (const { type, emailEnabled } of prefs) {
      await db
        .insert(notificationPreferences)
        .values({
          userId: teamUser.id,
          notificationType: type,
          emailEnabled,
        })
        .onConflictDoUpdate({
          target: [notificationPreferences.userId, notificationPreferences.notificationType],
          set: {
            emailEnabled,
            updatedAt: new Date(),
          },
        });
    }

    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { error: 'Failed to save notification preferences' };
  }
}
```

**Dependency**: Task 1 must be complete (table must exist for the UNIQUE constraint).

---

### TASK 3: Update notify.js to Respect Preferences

**File: `src/lib/notifications/notify.js`**

This is the critical change. Currently, `sendTeamNotification` (line 32) and `sendUserNotification` (line 76) ALWAYS send email. We need to check each user's preferences before sending email.

Step 1 — Add import at line 2 (after `inAppNotifications, teamUsers`):
```javascript
import { inAppNotifications, teamUsers, notificationPreferences } from '@/lib/db/schema';
```
NOTE: `and` is NOT currently imported. The existing import on line 3 is: `import { eq, and, desc, count, sql } from 'drizzle-orm';` — CHECK THIS. If `and` is already there, great. If not, add it.

Step 2 — Add a helper function after `getActiveTeamUsers()` (after line 14, before the `crmLink` function at line 16):

```javascript
/**
 * Get user IDs that have email DISABLED for a notification type.
 * Returns a Set of user IDs. Defaults to empty (all emails sent) on failure.
 */
async function getEmailDisabledUsers(userIds, notificationType) {
  if (userIds.length === 0) return new Set();
  try {
    const prefs = await db
      .select({ userId: notificationPreferences.userId })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.notificationType, notificationType),
          eq(notificationPreferences.emailEnabled, false)
        )
      );
    return new Set(prefs.map(p => p.userId));
  } catch {
    // If table doesn't exist or query fails, default to sending all emails
    return new Set();
  }
}
```

Step 3 — Modify `sendTeamNotification`. Replace the email-sending loop (lines 52-60):

CURRENT (lines 52-60):
```javascript
    // Also send email to each (non-blocking)
    const fullLink = link ? crmLink(link) : null;
    for (const m of recipients) {
      sendEmail({
        to: m.email,
        subject: title,
        html: `<p>${body || title}</p>${fullLink ? `<p><a href="${fullLink}">View in CRM</a></p>` : ''}`,
      }).catch(() => {});
    }
```

REPLACE WITH:
```javascript
    // Also send email to each (non-blocking, respecting preferences)
    const fullLink = link ? crmLink(link) : null;
    const emailDisabled = await getEmailDisabledUsers(recipients.map(m => m.id), type);
    for (const m of recipients) {
      if (emailDisabled.has(m.id)) continue;
      sendEmail({
        to: m.email,
        subject: title,
        html: `<p>${body || title}</p>${fullLink ? `<p><a href="${fullLink}">View in CRM</a></p>` : ''}`,
      }).catch(() => {});
    }
```

Step 4 — Modify `sendUserNotification`. Replace lines 93-99:

CURRENT (lines 93-99):
```javascript
    if (user) {
      const fullLink = link ? crmLink(link) : null;
      sendEmail({
        to: user.email,
        subject: title,
        html: `<p>${body || title}</p>${fullLink ? `<p><a href="${fullLink}">View in CRM</a></p>` : ''}`,
      }).catch(() => {});
    }
```

REPLACE WITH:
```javascript
    if (user) {
      // Check if user has email disabled for this type
      const disabled = await getEmailDisabledUsers([userId], type);
      if (!disabled.has(userId)) {
        const fullLink = link ? crmLink(link) : null;
        sendEmail({
          to: user.email,
          subject: title,
          html: `<p>${body || title}</p>${fullLink ? `<p><a href="${fullLink}">View in CRM</a></p>` : ''}`,
        }).catch(() => {});
      }
    }
```

Step 5 — Add `markNotificationUnread` function at the end of the file (after `markAllNotificationsRead`, after line 147):

```javascript
/**
 * Mark a single notification as unread.
 */
export async function markNotificationUnread(notificationId, userId) {
  await db
    .update(inAppNotifications)
    .set({ isRead: false })
    .where(and(eq(inAppNotifications.id, notificationId), eq(inAppNotifications.userId, userId)));
}
```

**IMPORTANT**: In-app notifications are ALWAYS inserted regardless of preferences. Only email delivery is gated.

**IMPORTANT**: The `getEmailDisabledUsers` helper has a try/catch that returns empty Set on failure. This means if the notification_preferences table doesn't exist (migration not run), everything degrades gracefully to the current behavior (all emails sent).

---

### TASK 4: Shared Notification Helpers

**File: Create `src/lib/utils/notification-helpers.js`**

Extract the NOTIFICATION_ICONS, NOTIFICATION_COLORS, and timeAgo() from NotificationBell.jsx so both the bell and the new NotificationCenter can use them.

```javascript
export const NOTIFICATION_ICONS = {
  pipeline_move: 'mdi:swap-horizontal-circle-outline',
  proposal_viewed: 'mdi:eye-outline',
  proposal_signed: 'mdi:check-decagram-outline',
  proposal_created: 'mdi:file-document-plus-outline',
  proposal_sent: 'mdi:send-outline',
  lead_assigned: 'mdi:account-arrow-right-outline',
  lead_stale: 'mdi:clock-alert-outline',
  lead_stage_change: 'mdi:swap-horizontal-circle-outline',
  milestone_completed: 'mdi:flag-checkered',
  milestone_overdue: 'mdi:flag-remove-outline',
  project_created: 'mdi:folder-plus-outline',
  project_completed: 'mdi:folder-check-outline',
  demo_approved: 'mdi:monitor-share',
  demo_shared: 'mdi:monitor-share',
  client_question: 'mdi:chat-question-outline',
  client_created: 'mdi:account-plus-outline',
  follow_up_reminder: 'mdi:bell-ring-outline',
  new_lead: 'mdi:account-star-outline',
  meeting_booked: 'mdi:calendar-check-outline',
  meeting_created: 'mdi:calendar-plus-outline',
  meeting_rescheduled: 'mdi:calendar-refresh-outline',
  meeting_cancelled: 'mdi:calendar-remove-outline',
  meeting_reminder: 'mdi:calendar-clock-outline',
  meeting_completed: 'mdi:calendar-check',
  payment_received: 'mdi:cash-check',
  invoice_created: 'mdi:receipt-text-plus-outline',
  invoice_sent: 'mdi:receipt-text-send-outline',
};

export const NOTIFICATION_COLORS = {
  pipeline_move: '#0dcaf0',
  proposal_viewed: '#0d6efd',
  proposal_signed: '#198754',
  proposal_created: '#0d6efd',
  proposal_sent: '#0d6efd',
  lead_assigned: '#6f42c1',
  lead_stale: '#ffc107',
  lead_stage_change: '#0dcaf0',
  milestone_completed: '#03FF00',
  milestone_overdue: '#dc3545',
  project_created: '#03FF00',
  project_completed: '#03FF00',
  demo_approved: '#fd7e14',
  demo_shared: '#fd7e14',
  client_question: '#ffc107',
  client_created: '#198754',
  follow_up_reminder: '#dc3545',
  new_lead: '#03FF00',
  meeting_booked: '#0dcaf0',
  meeting_created: '#0dcaf0',
  meeting_rescheduled: '#ffc107',
  meeting_cancelled: '#dc3545',
  meeting_reminder: '#ffc107',
  meeting_completed: '#198754',
  payment_received: '#198754',
  invoice_created: '#0d6efd',
  invoice_sent: '#0d6efd',
};

/**
 * Category grouping for notification types.
 */
export const NOTIFICATION_CATEGORIES = {
  'Lead Activity': ['new_lead', 'lead_assigned', 'lead_stage_change', 'lead_stale', 'pipeline_move'],
  'Projects & Milestones': ['project_created', 'project_completed', 'milestone_completed', 'milestone_overdue', 'demo_approved', 'demo_shared'],
  'Proposals': ['proposal_created', 'proposal_sent', 'proposal_viewed', 'proposal_signed'],
  'Invoices & Payments': ['invoice_created', 'invoice_sent', 'payment_received'],
  'Meetings': ['meeting_booked', 'meeting_created', 'meeting_rescheduled', 'meeting_cancelled', 'meeting_reminder', 'meeting_completed'],
  'Client Portal': ['client_created', 'client_question', 'follow_up_reminder'],
};

/**
 * Human-readable label for a notification type.
 */
export function typeLabel(type) {
  return (type || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Relative time string.
 */
export function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
```

**File: Update `src/components/crm/NotificationBell.jsx`** — Replace local constants with imports.

Remove the local `NOTIFICATION_ICONS` constant (lines 7-34), `NOTIFICATION_COLORS` constant (lines 36-63), and `timeAgo` function (lines 65-77). Replace with:

```javascript
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS, timeAgo } from '@/lib/utils/notification-helpers';
```

Add this import near the top (after line 5, the `Icon` import).

**Verify**: After this change, the bell must still work exactly as before. Same icons, same colors, same time formatting.

---

### TASK 5: Notification History API Route

**File: Create `src/app/api/notifications/history/route.js`**

```javascript
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getTeamUser } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { inAppNotifications } from '@/lib/db/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';

const CATEGORY_TYPES = {
  leads: ['pipeline_move', 'lead_assigned', 'lead_stale', 'lead_stage_change', 'new_lead'],
  projects: ['project_created', 'project_completed', 'milestone_completed', 'milestone_overdue', 'demo_approved', 'demo_shared'],
  proposals: ['proposal_created', 'proposal_sent', 'proposal_viewed', 'proposal_signed'],
  invoices: ['invoice_created', 'invoice_sent', 'payment_received'],
  meetings: ['meeting_booked', 'meeting_created', 'meeting_rescheduled', 'meeting_cancelled', 'meeting_reminder', 'meeting_completed'],
  clients: ['client_created', 'client_question', 'follow_up_reminder'],
};

/**
 * GET /api/notifications/history — fetch ALL notifications (read + unread) for the current user.
 * Query params: page (default 1), filter (all|unread|read), category (all|leads|projects|proposals|invoices|meetings|clients)
 */
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await getTeamUser(cookieStore);
    if (!teamUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const perPage = 25;
    const filter = searchParams.get('filter') || 'all';
    const category = searchParams.get('category') || 'all';

    // Build conditions
    const conditions = [eq(inAppNotifications.userId, teamUser.id)];

    if (filter === 'unread') {
      conditions.push(eq(inAppNotifications.isRead, false));
    } else if (filter === 'read') {
      conditions.push(eq(inAppNotifications.isRead, true));
    }

    if (category !== 'all' && CATEGORY_TYPES[category]) {
      const types = CATEGORY_TYPES[category];
      conditions.push(sql`${inAppNotifications.type} = ANY(ARRAY[${sql.join(types.map(t => sql`${t}`), sql`, `)}]::text[])`);
    }

    const where = and(...conditions);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(inAppNotifications)
      .where(where);

    // Get paginated results
    const notifications = await db
      .select()
      .from(inAppNotifications)
      .where(where)
      .orderBy(desc(inAppNotifications.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage);

    return NextResponse.json({
      notifications,
      total: Number(total),
      page,
      perPage,
      totalPages: Math.ceil(Number(total) / perPage),
    });
  } catch {
    return NextResponse.json({ notifications: [], total: 0, page: 1, perPage: 25, totalPages: 0 });
  }
}
```

**IMPORTANT**: The SQL array comparison `= ANY(ARRAY[...]::text[])` is the Drizzle-compatible way to filter by a list of text values. Test this carefully — if it doesn't work with Drizzle's `sql` tag, use `inArray(inAppNotifications.type, types)` from drizzle-orm instead:

```javascript
import { inArray } from 'drizzle-orm';
// ...
conditions.push(inArray(inAppNotifications.type, types));
```

**File: Update `src/app/api/notifications/route.js`** — Add `mark_unread` action.

Step 1 — Add import at line 8 (after `markAllNotificationsRead`):
```javascript
import {
  getUnreadNotifications,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationUnread,
} from '@/lib/notifications/notify';
```

Step 2 — After the `mark_all_read` handler (after line 55), add:
```javascript
    if (body.action === 'mark_unread' && body.notificationId) {
      await markNotificationUnread(body.notificationId, teamUser.id);
      return NextResponse.json({ success: true });
    }
```

---

### TASK 6: Notification Center Page + Component

**File: Create `src/app/notifications/page.jsx`** (server component)

```jsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import NotificationCenter from '@/components/crm/NotificationCenter';
import { requireTeam } from '@/lib/auth/helpers';

export const metadata = {
  title: 'Notifications — Botmakers CRM',
};

const Page = async () => {
  const cookieStore = await cookies();
  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  return (
    <MasterLayout>
      <NotificationCenter />
    </MasterLayout>
  );
};

export default Page;
```

**File: Create `src/components/crm/NotificationCenter.jsx`** (client component)

This is the main UI. Follow WowDash patterns: Bootstrap 5, dark theme, @iconify/react icons, NO Tailwind.

**Required imports:**
```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS, timeAgo } from '@/lib/utils/notification-helpers';
```

**Component structure:**
1. **Header**: "Notifications" h4 + "Mark all as read" button (right-aligned), unread count badge
2. **Filter bar**:
   - Category pills: All, Leads, Projects, Proposals, Invoices, Meetings, Clients
   - Status pills: All, Unread, Read
   - Use `.btn btn-sm btn-outline-secondary` for inactive, `.btn btn-sm btn-primary` for active
3. **Notification list**:
   - Each item is a card-like row with: icon (from NOTIFICATION_ICONS), title, body, timeAgo, read/unread dot, toggle read/unread button (eye icon)
   - Unread items: subtle blue-tinted background `rgba(13,110,253,0.06)`
   - Read items: no background tint
   - Click anywhere on the row → navigate to `notification.link` + mark as read
   - Small toggle button: `mdi:eye-outline` (mark as read) or `mdi:eye-off-outline` (mark as unread) — use `e.stopPropagation()` to prevent navigation
4. **Pagination**: Bootstrap `.pagination` component at bottom
5. **Empty state**: "No notifications found" with icon `mdi:bell-check-outline`
6. **Loading state**: Skeleton or spinner while fetching

**Key behaviors:**
1. Fetches from `GET /api/notifications/history?page=N&filter=X&category=Y`
2. Clicking a notification: calls `POST /api/notifications` with `{ action: 'mark_read', notificationId }`, then `router.push(notification.link)`
3. "Mark all as read": calls `POST /api/notifications` with `{ action: 'mark_all_read' }`, refreshes list
4. Toggle read/unread: calls `POST /api/notifications` with `mark_read` or `mark_unread`, updates local state
5. Filter changes reset to page 1
6. Pagination changes trigger new fetch

**Styling rules:**
- Card wrapping: `<div className="card"><div className="card-body p-0">...</div></div>`
- Table-like rows: `d-flex align-items-center gap-3 px-3 py-2` with `border-bottom: 1px solid rgba(255,255,255,0.04)`
- Icon circles: 32x32 with `background: ${color}22`, same as bell dropdown
- Pagination: `nav` > `ul.pagination.pagination-sm.justify-content-center` with Bootstrap page items
- Responsive: full-width, card fills available space

---

### TASK 7: Add Sidebar Nav Entry

**File: `src/masterLayout/MasterLayout.jsx`**

The sidebar nav items are defined in the `sidebarItems` array (around lines 11-28). Add a "Notifications" entry.

Find the `"separator"` entry in the array. Add the Notifications item BEFORE the separator (after Calendar):
```javascript
{ label: 'Notifications', icon: 'mdi:bell-outline', href: '/notifications' },
```

The result should look like:
```javascript
  { label: "Calendar", icon: "mdi:calendar-month-outline", href: "/calendar" },
  { label: "Notifications", icon: "mdi:bell-outline", href: "/notifications" },
  "separator",
  { label: "Settings", icon: "solar:settings-outline", href: "/settings" },
```

---

### TASK 8: Update NotificationBell Footer Link + Real-Time Listener

**File: `src/components/crm/NotificationBell.jsx`**

**Part A — Change footer link:**

Find the "View all activity" button near the bottom of the file (around line 289):
```javascript
onClick={() => { setOpen(false); router.push('/activity'); }}
```
Change to:
```javascript
onClick={() => { setOpen(false); router.push('/notifications'); }}
```

And change the button text from "View all activity" to "View all notifications".

**Part B — Add real-time listener:**

The `RealtimeNotificationProvider` (already rendered in the layout) dispatches a `crm:new-notification` CustomEvent on the `window` object when a new notification arrives via Supabase Realtime. Currently, the bell ONLY polls every 30 seconds and misses real-time events.

Add a new `useEffect` after the existing polling useEffect (after line 107):

```javascript
  // Listen for real-time notification events
  useEffect(() => {
    const handleNewNotification = () => {
      fetchNotifications();
    };
    window.addEventListener('crm:new-notification', handleNewNotification);
    return () => window.removeEventListener('crm:new-notification', handleNewNotification);
  }, [fetchNotifications]);
```

This makes the bell refresh instantly when `RealtimeNotificationProvider` fires an event, instead of waiting up to 30 seconds.

---

### TASK 9: Notification Preferences UI in Settings

**File: `src/components/crm/SettingsPage.jsx`**

The Notifications tab is the `NotificationsTab` function component (lines 268-357). Currently it shows:
- Stale lead threshold (editable number) — **KEEP THIS**
- 7 notification types listed with static "Active" badge — **REPLACE THIS**

Step 1 — Add import for `saveNotificationPreferences` at line 9 (where other settings actions are imported):
```javascript
import { inviteTeamMember, toggleTeamMemberActive, saveSetting, saveCalendarColors, saveNotificationPreferences } from '@/lib/actions/settings';
```

Step 2 — Import notification helpers:
```javascript
import { NOTIFICATION_CATEGORIES, typeLabel } from '@/lib/utils/notification-helpers';
```

Step 3 — Update the `NotificationsTab` component signature. Change:
```javascript
function NotificationsTab({ initialStaleDays }) {
```
to:
```javascript
function NotificationsTab({ initialStaleDays, currentUserId }) {
```

Step 4 — Add state and fetch for preferences inside NotificationsTab (after the existing state declarations):
```javascript
  const [prefs, setPrefs] = useState({});
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(res => res.json())
      .then(data => {
        setPrefs(data.preferences || {});
        setPrefsLoading(false);
      })
      .catch(() => setPrefsLoading(false));
  }, []);
```

Step 5 — Add toggle handler:
```javascript
  const toggleEmail = (type) => {
    setPrefs(prev => ({
      ...prev,
      [type]: { emailEnabled: prev[type]?.emailEnabled === false ? true : false },
    }));
  };

  const handleSavePrefs = async () => {
    setPrefsSaving(true);
    const prefsList = Object.entries(prefs).map(([type, val]) => ({
      type,
      emailEnabled: val.emailEnabled !== false,
    }));
    const result = await saveNotificationPreferences(prefsList);
    if (result.success) {
      toast.success('Notification preferences saved');
    } else {
      toast.error(result.error || 'Failed to save preferences');
    }
    setPrefsSaving(false);
  };
```

Step 6 — Replace the static notification type list card (lines 323-354). Keep the "Stale Lead Detection" card above it. Replace everything from `<div className="card">` (line 323) through its closing `</div>` (line 354) with:

```jsx
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h6 className="text-white fw-semibold mb-0">Email Notification Preferences</h6>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSavePrefs}
            disabled={prefsSaving || prefsLoading}
          >
            {prefsSaving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
            Save Preferences
          </button>
        </div>
        <div className="card-body">
          <p className="text-secondary-light text-sm mb-3">
            In-app notifications are always on. Toggle email delivery per notification type.
          </p>
          {prefsLoading ? (
            <div className="text-center py-4">
              <span className="spinner-border spinner-border-sm text-secondary-light" />
            </div>
          ) : (
            Object.entries(NOTIFICATION_CATEGORIES).map(([category, types]) => (
              <div key={category} className="mb-4">
                <h6 className="text-secondary-light fw-medium text-xs text-uppercase mb-2" style={{ letterSpacing: '0.5px' }}>
                  {category}
                </h6>
                <div className="d-flex flex-column gap-1">
                  {types.map((type) => {
                    const emailOn = prefs[type]?.emailEnabled !== false;
                    return (
                      <div
                        key={type}
                        className="d-flex align-items-center justify-content-between p-2 rounded"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <span className="text-white text-sm">{typeLabel(type)}</span>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                          <div className="d-flex align-items-center gap-1">
                            <span className="text-secondary-light" style={{ fontSize: '11px' }}>In-app</span>
                            <div className="form-check form-switch mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked
                                disabled
                                style={{ opacity: 0.5 }}
                              />
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-1">
                            <span className="text-secondary-light" style={{ fontSize: '11px' }}>Email</span>
                            <div className="form-check form-switch mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={emailOn}
                                onChange={() => toggleEmail(type)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
```

Step 7 — Pass `currentUserId` to NotificationsTab. In the main SettingsPage component, where the Notifications tab is rendered (line 76-78):

CURRENT:
```jsx
      {activeTab === 'notifications' && (
        <NotificationsTab initialStaleDays={initialStaleDays} />
      )}
```

No change needed if we're fetching preferences client-side via the API (which reads from the session). Keep as-is.

---

### TASK 10: Notification Preferences API Route

**File: Create `src/app/api/notifications/preferences/route.js`**

```javascript
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getTeamUser } from '@/lib/auth/helpers';
import { getUserPreferences } from '@/lib/db/queries/notification-preferences';

/**
 * GET /api/notifications/preferences — fetch notification preferences for current user.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await getTeamUser(cookieStore);
    if (!teamUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preferences = await getUserPreferences(teamUser.id);
    return NextResponse.json({ preferences });
  } catch {
    return NextResponse.json({ preferences: {} });
  }
}
```

---

### TASK 11: Build Verification

Run `npm run build` from `file/` directory. If `rm -rf .next` is needed due to stale cache errors, do it first. Fix any import errors, missing dependencies, or type issues.

**Common issues to watch for:**
- Circular imports between notify.js and schema.js — both import from schema, should be fine
- Missing `and` import in notify.js — check line 3 first
- The `onConflictDoUpdate` in `saveNotificationPreferences` requires the `target` columns to have a UNIQUE constraint — we defined it in the migration
- The `inArray` function might be needed for category filtering if `sql` template approach doesn't work with Drizzle
- The `useEffect` import in SettingsPage.jsx — check if `useEffect` is already imported (it uses `useState` from react, may need to add `useEffect`)
- NotificationBell.jsx: after removing local constants, verify the import path `@/lib/utils/notification-helpers` resolves correctly

---

### TASK 12: Run Migration + E2E Verification

After all code changes and build pass:

1. **Run migration**: `cd file && node scripts/run-migration-0016.mjs`
2. **Start dev server**: `npm run dev` (or verify build passed)
3. **Verify Notification Center**: Navigate to `/notifications` — should show all past notifications (if any exist in DB)
4. **Verify filters**: Click category pills and status filters — results should change
5. **Verify pagination**: If >25 notifications, page controls should work
6. **Verify preferences**: Go to Settings → Notifications tab → toggle email off for a type → Save → refresh page → verify toggle persists
7. **Verify email gating**: The preference check is tested by reviewing the code path in notify.js
8. **Verify bell link**: Click "View all notifications" in bell dropdown → should navigate to `/notifications`
9. **Verify sidebar**: "Notifications" link should appear in sidebar nav
10. **Verify bell real-time**: RealtimeNotificationProvider fires events → bell should refresh instantly

---

### TASK 13: Generate Batch 5 Prompt

After ALL tasks above are complete and the build passes clean:

**Audit the codebase** to identify the next highest-impact batch of work. Read the existing spec docs (`BUILD-STATE.md`, `PROJECT-SPEC.md`, `SPEC-PAGES.md`) and audit the current state. Consider these candidate areas:

1. **Real-time enhancement** — NotificationCenter should also listen for `crm:new-notification` events
2. **Comprehensive E2E test coverage** — Playwright tests exist but are minimal
3. **Performance optimization** — Dashboard has 12 parallel queries, audit for N+1 or slow queries
4. **Export & reporting** — CSV export of leads, clients, invoices; dashboard analytics
5. **Advanced portal features** — File sharing, real-time project updates
6. **Mobile PWA polish** — Better offline experience, push notifications
7. **Search** — Global search across all entities

Write the Batch 5 prompt in the SAME detailed format as this one:
- Context section explaining what exists
- What's missing / being built
- Atomic tasks with exact file paths and line numbers
- Code snippets for every change
- Dependencies clearly stated
- Build verification + E2E as final tasks
- Important rules section

Save as `BATCH-5-PROMPT.md` at the project root (not in `file/`).

---

## IMPORTANT RULES TO FOLLOW

1. **WowDash/Bootstrap patterns** — NO Tailwind. Use Bootstrap classes, `@iconify/react` icons.
2. **All server actions in try/catch** — friendly error messages.
3. **Non-blocking notifications** — always `.catch(() => {})` on notification calls in notify.js.
4. **Don't break existing behavior** — the bell must continue working exactly as before. Preferences default to "email enabled" so existing behavior is preserved until a user explicitly opts out.
5. **Read before editing** — always read a file before modifying it.
6. **Dark theme** — navy (#033457) primary, green (#03FF00) accents.
7. **The `file/` directory** — all Next.js code is in `file/`. Root has spec docs and CLAUDE.md.
8. **Graceful degradation** — if the notification_preferences table doesn't exist (migration not run), `getEmailDisabledUsers()` returns empty Set, meaning all emails still send. NEVER break notifications because preferences aren't set up.
9. **In-app is ALWAYS on** — preferences only control email delivery. The in-app notification always inserts regardless.
10. **Settings import pattern** — SettingsPage.jsx is a client component. Server actions must be imported directly (they work in client components via 'use server' boundary).
11. **Don't modify notification wiring** — Don't touch the 25+ files that call `sendTeamNotification` or `sendUserNotification`. Only modify `notify.js` itself.
12. **useEffect import** — SettingsPage.jsx currently imports only `useState` from react (line 3). If you add `useEffect`, add it to that import.

## FILES REFERENCE
```
NEW FILES:
  drizzle/0016_notification_preferences.sql          — Migration
  scripts/run-migration-0016.mjs                     — Migration runner
  src/lib/db/queries/notification-preferences.js     — getUserPreferences, isEmailEnabled
  src/lib/utils/notification-helpers.js              — Shared ICONS/COLORS/timeAgo/categories/typeLabel
  src/app/api/notifications/history/route.js         — GET paginated notification history
  src/app/api/notifications/preferences/route.js     — GET user preferences
  src/app/notifications/page.jsx                     — Notification Center page
  src/components/crm/NotificationCenter.jsx          — Main notification center UI

MODIFIED FILES:
  src/lib/db/schema.js                               — Add notificationPreferences table (after line 500)
  src/lib/notifications/notify.js                    — Add getEmailDisabledUsers, check prefs before email, add markNotificationUnread
  src/lib/actions/settings.js                        — Add saveNotificationPreferences action
  src/app/api/notifications/route.js                 — Add mark_unread action, import markNotificationUnread
  src/components/crm/SettingsPage.jsx                — Replace static notif list with preferences UI
  src/components/crm/NotificationBell.jsx            — Import shared helpers, change footer link, add real-time listener
  src/masterLayout/MasterLayout.jsx                  — Add Notifications sidebar nav entry
```

## EXECUTION ORDER MATTERS

Task 1 (migration + schema) → Task 2 (queries + actions) → Task 3 (update notify.js) → Task 4 (shared helpers) → Tasks 5-10 (partially parallelizable: API routes, page, component, sidebar, bell, settings) → Task 11 (build) → Task 12 (migration + E2E) → Task 13 (write Batch 5 prompt)

Tasks 5-10 are partially parallelizable (creating new files doesn't depend on each other), but Tasks 1-4 must be sequential as each builds on the previous.
