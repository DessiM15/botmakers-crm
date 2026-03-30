# BATCH 3: Webhook Notification Parity + Dashboard Fix + Pipeline In-App — Detailed Implementation Plan

## CONTEXT: What Exists Right Now

This is the Botmakers CRM (WowDash Next.js 15 template, Bootstrap 5, dark theme). All code lives in `file/` subdirectory.

**Batch 1** (commit 88eb5be) extracted `milestone-internal.js` shared helper, wired meeting notifications, added markPaid parity, DRYed calendar sync, added 8 notification enum values, added `completedAt` column to project_phases.

**Batch 2** (commit f901688) wired in-app notifications for 12 previously silent server actions (createProject, createClient, convertLeadToClient, createProposal, sendProposal, createInvoice, sendViaSquare, updateLeadAssignment, Cal.com reschedule/cancel, stale-leads cron, overdue-milestones cron). Added 7 new notification enum values (migration 0015). Created meeting-reminders and meeting-autocomplete cron jobs.

---

## TWO NOTIFICATION SYSTEMS (Critical — Review Before Coding)

1. **inAppNotifications table** — Used by `src/lib/notifications/notify.js`. The `type` column is **plain text** (NOT enum-constrained). Any string works. Functions:
   - `sendTeamNotification({ type, title, body, link, excludeUserId })` — inserts row for ALL active team members + sends basic email to each
   - `sendUserNotification({ userId, type, title, body, link })` — inserts row for ONE user + sends email
2. **notifications table** — Used by `src/lib/email/notifications.js`. The `type` column IS constrained by `notificationTypeEnum`. Functions send branded HTML emails + log to this table via `sendNotification()`.

**Key rule**: `sendTeamNotification` handles in-app bell icon alerts. `sendNotification` (called internally by email template functions in `notifications.js`) handles the branded email log. Many actions need BOTH.

---

## WHAT ALREADY HAS NOTIFICATIONS (Don't Touch These)

| Action | In-App | Email |
|--------|--------|-------|
| completeMilestoneInternal (milestone-internal.js) | Team | Client (milestoneCompletedEmail) |
| updateLeadStage (leads.js) | Team | Team (leadStageChange) |
| createMeeting (meetings.js) | Team | Team (meetingCreatedAlert) |
| updateMeetingStatus (meetings.js) | Team | Attendee cancel email |
| markPaid (invoices.js) | Team | Client receipt + Team (paymentReceived) |
| toggleDemoApproval (repos.js) | Team | Client (demoApprovedEmail) |
| Cal.com BOOKING_CREATED (cal/route.js) | Team | Team (meetingBookedAlert) |
| Cal.com BOOKING_RESCHEDULED (cal/route.js) | Team | None |
| Cal.com BOOKING_CANCELLED (cal/route.js) | Team | None |
| new-lead webhook | Team | Team (newLeadAlert) |
| Portal: acceptProposal | Team | Team (proposalAccepted) |
| Portal: submitQuestion | Team | Team (clientQuestion) |
| createProject (projects.js) | Team | None |
| createClient (clients.js) | Team | None |
| convertLeadToClientInternal (clients.js) | Team | welcomeClient email |
| createProposal (proposals.js) | Team | None |
| sendProposal (proposals.js) | Team | proposalSent email to client |
| createInvoice (invoices.js) | Team | None |
| sendViaSquare (invoices.js) | Team | invoiceSent email to client |
| updateLeadAssignment (leads.js) | User | None |
| stale-leads cron | Team | Team (staleLeadAlert) |
| overdue-milestones cron | Team | Team (milestoneOverdue) |
| meeting-reminders cron | Team | None |
| meeting-autocomplete cron | None | None (housekeeping) |

---

## WHAT'S MISSING (This Batch Closes ALL Gaps)

| Action | Gap | Fix |
|--------|-----|-----|
| **Square webhook** (payment.completed) | Has email but NO in-app | Add sendTeamNotification |
| **Square webhook** (invoice.payment_made) | NO notifications at all | Add sendTeamNotification + paymentReceived email |
| **Vercel webhook** (deployment.ready) | NO notifications | Add sendTeamNotification |
| **advanceLead** (pipeline/transitions.js) | Has email but NO in-app | Add sendTeamNotification |
| **service-renewals cron** | Has email but NO in-app | Add sendTeamNotification |
| **follow-up-reminders cron** | NO notifications | Add sendTeamNotification |
| **updateProjectStatus('completed')** | Sends client email but NO team in-app | Add sendTeamNotification |
| **Dashboard TodaySchedule** | Widget shows empty — page.jsx never calls `getTodaysMeetings()` | Wire the query + pass prop |

---

## BATCH 3 TASKS (Execute in This Order)

### TASK 1: Fix Dashboard TodaySchedule Widget

**Problem**: `src/app/page.jsx` fetches 10 parallel queries but does NOT call `getTodaysMeetings()`. The `TodaySchedule` component (which expects a `meetings` prop) is NOT rendered in `DashBoardLayer.jsx` at all — it was designed but never wired into the dashboard layout.

**File: `src/app/page.jsx`**

Step 1 — Add the import. Change line 6-15:
```javascript
import {
  getMetrics,
  getAlerts,
  getRecentActivity,
  getUpcomingMilestones,
  getRevenueMetrics,
  getLeadSourceAnalytics,
  getUnassignedLeads,
  getTeamMembersForAssignment,
} from '@/lib/db/queries/dashboard';
```
to:
```javascript
import {
  getMetrics,
  getAlerts,
  getRecentActivity,
  getUpcomingMilestones,
  getRevenueMetrics,
  getLeadSourceAnalytics,
  getUnassignedLeads,
  getTeamMembersForAssignment,
} from '@/lib/db/queries/dashboard';
import { getTodaysMeetings } from '@/lib/db/queries/meetings';
```

Step 2 — Add to the destructuring (line 34). Change:
```javascript
let metrics, alerts, activity, upcomingMilestones, revenue, leadSources, followUps, unassignedLeads, teamMembersForAssign, upcomingRenewals;
```
to:
```javascript
let metrics, alerts, activity, upcomingMilestones, revenue, leadSources, followUps, unassignedLeads, teamMembersForAssign, upcomingRenewals, todaysMeetings;
```

Step 3 — Add to the Promise.all (line 36). After `getUpcomingRenewals(7).catch(() => []),` add:
```javascript
getTodaysMeetings().catch(() => []),
```
And update the destructuring to include `todaysMeetings` at the end.

Step 4 — Add fallback in the catch block (after line 60):
```javascript
todaysMeetings = [];
```

Step 5 — Pass the prop to DashBoardLayer (after `upcomingRenewals`):
```javascript
todaysMeetings={todaysMeetings}
```

**File: `src/components/crm/DashBoardLayer.jsx`**

Step 1 — Add TodaySchedule import (after line 9):
```javascript
import TodaySchedule from './TodaySchedule';
```

Step 2 — Add `todaysMeetings = []` to the component props destructuring (line 34-46).

Step 3 — Add the TodaySchedule component into the layout. Replace the "Upcoming Tasks + Alerts" section (lines 93-102):
```jsx
{/* Upcoming Tasks + Today's Schedule + Alerts */}
<section className="row gy-4 mt-1">
  <div className="col-xxl-4 col-lg-6">
    <UpcomingTasks milestones={upcomingMilestones} />
  </div>
  <div className="col-xxl-4 col-lg-6">
    <TodaySchedule meetings={todaysMeetings} upcomingMilestones={upcomingMilestones} />
  </div>
  <div className="col-xxl-4 col-lg-12">
    <AlertsPanel alerts={alerts} />
  </div>
</section>
```

**Dependency**: `getTodaysMeetings()` already exists in `src/lib/db/queries/meetings.js` (lines 202-230). It queries meetings table for today, status = scheduled|rescheduled.

---

### TASK 2: Square Webhook In-App Notifications

**File: `src/app/api/webhooks/square/route.js`**

This file currently imports email helpers but NOT `sendTeamNotification`.

Step 1 — Add import (after line 8):
```javascript
import { sendTeamNotification } from '@/lib/notifications/notify';
```

Step 2 — In the `payment.completed` handler, after `paymentReceivedNotif(invoice, ...)` (line 170), add:
```javascript
// Team in-app notification (non-blocking)
sendTeamNotification({
  type: 'payment_received',
  title: `Payment received: ${invoice.title}`,
  body: `$${amount.toFixed(2)} via Square`,
  link: `/invoices/${invoice.id}`,
}).catch(() => {});
```

Step 3 — In the `invoice.payment_made` handler (around line 219), after the activity log insert, add:
```javascript
// Send client receipt email (non-blocking)
const [client] = await db
  .select({ email: clients.email, fullName: clients.fullName })
  .from(clients)
  .where(eq(clients.id, invoice.clientId))
  .limit(1);

if (client?.email) {
  sendEmail({
    to: client.email,
    subject: `Payment Receipt: ${invoice.title}`,
    html: paymentReceipt(client.fullName || 'there', invoice.title, invoice.amount),
  }).catch(() => {});
}

// Team email notification (non-blocking)
paymentReceivedNotif(invoice, { amount: invoice.amount }).catch(() => {});

// Team in-app notification (non-blocking)
sendTeamNotification({
  type: 'payment_received',
  title: `Payment received: ${invoice.title}`,
  body: `$${Number(invoice.amount).toFixed(2)} via Square invoice`,
  link: `/invoices/${invoice.id}`,
}).catch(() => {});
```

**Important**: The `invoice.payment_made` handler currently only marks the invoice as paid and logs activity. It sends NO email and NO in-app notification. This brings it to full parity with the `payment.completed` handler and the `markPaid` server action.

---

### TASK 3: Vercel Webhook In-App Notification

**File: `src/app/api/webhooks/vercel/route.js`**

This file currently has NO notification imports.

Step 1 — Add import (after line 5):
```javascript
import { sendTeamNotification } from '@/lib/notifications/notify';
```

Step 2 — Inside the `for (const repo of matchingRepos)` loop, after the activity log insert (line 111), add:
```javascript
// Team in-app notification (non-blocking)
sendTeamNotification({
  type: 'demo_shared',
  title: `Demo auto-pulled: ${repoOwner}/${repoName}`,
  body: `Preview: ${previewUrl}`,
  link: `/projects/${repo.projectId}`,
}).catch(() => {});
```

**Note**: We use `demo_shared` type (already in the enum) since it's the closest match for demo-related notifications.

---

### TASK 4: advanceLead In-App Notification

**File: `src/lib/pipeline/transitions.js`**

This file currently calls `leadStageChange(lead, currentStage, newStage)` for email but does NOT call `sendTeamNotification`.

Step 1 — Add import (after line 4):
```javascript
import { sendTeamNotification } from '@/lib/notifications/notify';
```

Step 2 — After line 97 (`leadStageChange(lead, currentStage, newStage).catch(() => {});`), add:
```javascript
// In-app notification (non-blocking)
sendTeamNotification({
  type: 'lead_stage_change',
  title: `${lead.fullName} auto-advanced to ${newStage.replace(/_/g, ' ')}`,
  body: `${currentStage.replace(/_/g, ' ')} → ${newStage.replace(/_/g, ' ')} (${trigger})`,
  link: `/leads/${leadId}`,
}).catch(() => {});
```

**Note**: This uses `lead_stage_change` type (already in enum). The notification body includes the trigger reason (e.g., "proposal_created", "lead_assigned") so team knows WHY it auto-advanced.

---

### TASK 5: Service Renewals Cron In-App Notification

**File: `src/app/api/cron/service-renewals/route.js`**

This file already calls `serviceRenewalAlert(renewals)` for email but does NOT send in-app notifications.

Step 1 — Add import (after line 6):
```javascript
import { sendTeamNotification } from '@/lib/notifications/notify';
```

Step 2 — After `await serviceRenewalAlert(renewals);` (line 47), add:
```javascript
// In-app notification (non-blocking)
sendTeamNotification({
  type: 'milestone_overdue',
  title: `${renewals.length} service${renewals.length > 1 ? 's' : ''} renewing soon`,
  body: renewals.map(r => r.serviceName || r.service_name).slice(0, 3).join(', ') + (renewals.length > 3 ? '...' : ''),
  link: '/services',
}).catch(() => {});
```

**Note**: We reuse `milestone_overdue` type since it's the closest "upcoming deadline" type. The `inAppNotifications.type` is free text so any string works for the bell icon, but using an existing type means consistent icon/color in NotificationBell.

---

### TASK 6: Follow-Up Reminders Cron In-App Notification

**File: `src/app/api/cron/follow-up-reminders/route.js`**

This file currently generates AI email drafts but does NOT send any notifications.

Step 1 — Add import (after line 4):
```javascript
import { sendTeamNotification, sendUserNotification } from '@/lib/notifications/notify';
```

Step 2 — After the `for` loop ends (after line 80), before the `return`, add:
```javascript
// Notify team about due follow-ups (non-blocking)
if (dueReminders.length > 0) {
  const assignedReminders = dueReminders.filter(r => r.assignedTo);
  const unassignedReminders = dueReminders.filter(r => !r.assignedTo);

  // Notify individually assigned team members
  for (const r of assignedReminders) {
    sendUserNotification({
      userId: r.assignedTo,
      type: 'lead_assigned',
      title: `Follow-up due: ${r.leadName}`,
      body: r.triggerReason || '',
      link: `/leads/${r.leadId}`,
    }).catch(() => {});
  }

  // Notify full team about unassigned follow-ups
  if (unassignedReminders.length > 0) {
    sendTeamNotification({
      type: 'lead_stale',
      title: `${unassignedReminders.length} unassigned follow-up${unassignedReminders.length > 1 ? 's' : ''} due`,
      body: unassignedReminders.map(r => r.leadName).slice(0, 3).join(', ') + (unassignedReminders.length > 3 ? '...' : ''),
      link: '/leads',
    }).catch(() => {});
  }
}
```

**Note**: Assigned follow-ups go to the specific team member. Unassigned follow-ups go to the whole team. Uses `lead_assigned` for assigned (user gets notified it's their responsibility) and `lead_stale` for unassigned (team alert).

**Dependency**: `sendUserNotification` is already exported from `notify.js`. The `followUpReminders` table has an `assignedTo` column that references team_users.

---

### TASK 7: updateProjectStatus('completed') In-App Notification

**File: `src/lib/actions/projects.js`**

The `updateProjectStatus` function (line 154) currently sends a client email when completing but NO team in-app notification.

Step 1 — In the `if (status === 'completed')` block, after the client email section (after line 210), add:
```javascript
// Team in-app notification (non-blocking)
sendTeamNotification({
  type: 'project_created',
  title: `Project completed: ${proj.name}`,
  body: 'All milestones done',
  link: `/projects/${projectId}`,
  excludeUserId: teamUser.id,
}).catch(() => {});
```

**Note**: `sendTeamNotification` is already imported in this file. We reuse `project_created` type since it's the project notification type.

---

### TASK 8: Add Missing Notification Icons to NotificationBell

**File: `src/components/crm/NotificationBell.jsx`**

The bell component has hardcoded icon/color maps but is missing entries for many notification types added in Batches 1-3.

Step 1 — Update `NOTIFICATION_ICONS` (lines 7-18) to:
```javascript
const NOTIFICATION_ICONS = {
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
```

Step 2 — Update `NOTIFICATION_COLORS` (lines 20-31) to:
```javascript
const NOTIFICATION_COLORS = {
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
```

---

### TASK 9: Build Verification

Run `npm run build` from `file/` directory. Fix any import errors, missing dependencies, or type issues. The build should pass clean (may have postcss-url-parser warnings — those are fine).

---

## IMPORTANT RULES TO FOLLOW

1. **WowDash/Bootstrap patterns** — NO Tailwind. Use Bootstrap classes, @iconify/react icons.
2. **All server actions in try/catch** — friendly error messages with CB-XXX codes.
3. **Non-blocking notifications** — always `.catch(() => {})` on notification calls.
4. **Don't break existing behavior** — add notifications alongside existing logic, don't restructure.
5. **Read before editing** — always read a file before modifying it.
6. **Dark theme** — navy (#033457) primary, green (#03FF00) accents.
7. **inAppNotifications.type is text** — any string works. notifications.type is enum-constrained.
8. **The `file/` directory** — all Next.js code is in `file/`. Root has spec docs and CLAUDE.md.
9. **Don't forget dependencies** — check if imports already exist before adding duplicates.
10. **Test the dashboard** — after Task 1, TodaySchedule should render meetings. Verify the component receives data.

## FILES REFERENCE
```
src/app/page.jsx                              — Dashboard page (10 parallel queries)
src/components/crm/DashBoardLayer.jsx         — Dashboard layout component
src/components/crm/TodaySchedule.jsx          — Today's meetings + milestones widget
src/components/crm/NotificationBell.jsx       — Bell icon + dropdown in header
src/lib/db/queries/meetings.js                — getTodaysMeetings() already exists (line 202)
src/lib/db/queries/dashboard.js               — Other dashboard queries
src/lib/notifications/notify.js               — sendTeamNotification, sendUserNotification
src/lib/email/notifications.js                — Branded email templates + sendNotification
src/app/api/webhooks/square/route.js          — Square payment webhook
src/app/api/webhooks/vercel/route.js          — Vercel deployment webhook
src/lib/pipeline/transitions.js               — advanceLead auto-transition helper
src/app/api/cron/service-renewals/route.js    — Service renewals cron
src/app/api/cron/follow-up-reminders/route.js — Follow-up reminders cron
src/lib/actions/projects.js                   — updateProjectStatus (line 154)
```

## EXECUTION ORDER MATTERS

Task 1 (dashboard fix — independent) → Tasks 2-7 (notification wiring — all independent of each other) → Task 8 (bell icons — depends on knowing all types) → Task 9 (build verification — must be last)
