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

  if (!pref) return true;
  return pref.emailEnabled;
}
