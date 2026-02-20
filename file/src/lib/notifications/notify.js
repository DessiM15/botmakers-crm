import { db } from '@/lib/db/client';
import { inAppNotifications, teamUsers } from '@/lib/db/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/client';

/**
 * Get all active team users (id + email).
 */
async function getActiveTeamUsers() {
  return db
    .select({ id: teamUsers.id, email: teamUsers.email, fullName: teamUsers.fullName })
    .from(teamUsers)
    .where(eq(teamUsers.isActive, true));
}

function crmLink(path) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return `${base}${path}`;
}

/**
 * Send an in-app notification to ALL active team members.
 * Also sends an email to each.
 *
 * @param {object} opts
 * @param {string} opts.type - notification type (pipeline_move, proposal_viewed, proposal_signed, etc.)
 * @param {string} opts.title - short title
 * @param {string} opts.body - optional body text
 * @param {string} opts.link - relative URL to navigate to (e.g. /leads/[id])
 * @param {string} [opts.excludeUserId] - exclude this user (e.g. the one who triggered it)
 */
export async function sendTeamNotification({ type, title, body, link, excludeUserId }) {
  try {
    const members = await getActiveTeamUsers();
    const recipients = excludeUserId
      ? members.filter((m) => m.id !== excludeUserId)
      : members;

    if (recipients.length === 0) return;

    // Insert in-app notifications for each team member
    const values = recipients.map((m) => ({
      userId: m.id,
      type,
      title,
      body: body || null,
      link: link || null,
    }));

    await db.insert(inAppNotifications).values(values);

    // Also send email to each (non-blocking)
    const fullLink = link ? crmLink(link) : null;
    for (const m of recipients) {
      sendEmail({
        to: m.email,
        subject: title,
        html: `<p>${body || title}</p>${fullLink ? `<p><a href="${fullLink}">View in CRM</a></p>` : ''}`,
      }).catch(() => {});
    }
  } catch {
    // Non-critical — don't break the parent action
  }
}

/**
 * Send an in-app notification to ONE specific team user.
 *
 * @param {object} opts
 * @param {string} opts.userId - team user UUID
 * @param {string} opts.type
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} opts.link
 */
export async function sendUserNotification({ userId, type, title, body, link }) {
  try {
    await db.insert(inAppNotifications).values({
      userId,
      type,
      title,
      body: body || null,
      link: link || null,
    });

    // Also send email
    const [user] = await db
      .select({ email: teamUsers.email })
      .from(teamUsers)
      .where(eq(teamUsers.id, userId))
      .limit(1);

    if (user) {
      const fullLink = link ? crmLink(link) : null;
      sendEmail({
        to: user.email,
        subject: title,
        html: `<p>${body || title}</p>${fullLink ? `<p><a href="${fullLink}">View in CRM</a></p>` : ''}`,
      }).catch(() => {});
    }
  } catch {
    // Non-critical
  }
}

/**
 * Get unread notifications for a user.
 */
export async function getUnreadNotifications(userId, limit = 10) {
  return db
    .select()
    .from(inAppNotifications)
    .where(and(eq(inAppNotifications.userId, userId), eq(inAppNotifications.isRead, false)))
    .orderBy(desc(inAppNotifications.createdAt))
    .limit(limit);
}

/**
 * Get total unread count for a user.
 */
export async function getNotificationCount(userId) {
  const [result] = await db
    .select({ count: count() })
    .from(inAppNotifications)
    .where(and(eq(inAppNotifications.userId, userId), eq(inAppNotifications.isRead, false)));
  return result?.count || 0;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId, userId) {
  await db
    .update(inAppNotifications)
    .set({ isRead: true })
    .where(and(eq(inAppNotifications.id, notificationId), eq(inAppNotifications.userId, userId)));
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(userId) {
  await db
    .update(inAppNotifications)
    .set({ isRead: true })
    .where(and(eq(inAppNotifications.userId, userId), eq(inAppNotifications.isRead, false)));
}
