'use server';

import crypto from 'crypto';
import { db } from '@/lib/db/client';
import { createAdminClient } from '@/lib/db/client';
import { teamUsers, systemSettings, notificationPreferences } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { requireAdmin, requireTeam } from '@/lib/auth/helpers';
import { revalidatePath } from 'next/cache';

/**
 * Invite a new team member.
 */
export async function inviteTeamMember(email, fullName, role = 'member') {
  try {
    const cookieStore = await cookies();
    await requireAdmin(cookieStore);

    if (!email || !fullName) {
      return { error: 'Email and name are required.' };
    }

    // Check if already exists
    const [existing] = await db
      .select({ id: teamUsers.id })
      .from(teamUsers)
      .where(eq(teamUsers.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      return { error: 'A team member with this email already exists.' };
    }

    // Create Supabase auth user
    const supabase = createAdminClient();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      return { error: 'Failed to create auth account. Please check the email and try again.' };
    }

    // Insert team_users record with the auth user's ID
    await db.insert(teamUsers).values({
      id: authData.user.id,
      email: email.toLowerCase().trim(),
      fullName: fullName.trim(),
      role,
    });

    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { error: 'Failed to invite team member.' };
  }
}

/**
 * Toggle team member active status.
 */
export async function toggleTeamMemberActive(userId, isActive) {
  try {
    const cookieStore = await cookies();
    await requireAdmin(cookieStore);

    await db
      .update(teamUsers)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(teamUsers.id, userId));

    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { error: 'Failed to update team member.' };
  }
}

/**
 * Save a system setting.
 */
export async function saveSetting(key, value) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireAdmin(cookieStore);

    // Upsert
    await db.execute(sql`
      INSERT INTO system_settings (id, key, value, updated_by, updated_at)
      VALUES (gen_random_uuid(), ${key}, ${JSON.stringify(value)}::jsonb, ${teamUser.id}, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = ${JSON.stringify(value)}::jsonb,
        updated_by = ${teamUser.id},
        updated_at = NOW()
    `);

    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { error: 'Failed to save setting.' };
  }
}

/**
 * Save calendar color preferences. Any team member can customize.
 */
export async function saveCalendarColors(colors) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    await db.execute(sql`
      INSERT INTO system_settings (id, key, value, updated_by, updated_at)
      VALUES (gen_random_uuid(), 'calendar_colors', ${JSON.stringify(colors)}::jsonb, ${teamUser.id}, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = ${JSON.stringify(colors)}::jsonb,
        updated_by = ${teamUser.id},
        updated_at = NOW()
    `);

    revalidatePath('/calendar');
    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { error: 'Failed to save calendar colors.' };
  }
}

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

/**
 * Generate a new Project Tracking API key.
 * Requires admin. Upserts into system_settings with key 'project_tracking_api_key'.
 */
export async function generateProjectTrackingApiKey() {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireAdmin(cookieStore);

    const key = 'btmk_' + crypto.randomBytes(48).toString('hex');

    await db.execute(sql`
      INSERT INTO system_settings (id, key, value, updated_by, updated_at)
      VALUES (gen_random_uuid(), 'project_tracking_api_key', ${JSON.stringify({ key, createdAt: new Date().toISOString(), createdBy: teamUser.id })}::jsonb, ${teamUser.id}, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = ${JSON.stringify({ key, createdAt: new Date().toISOString(), createdBy: teamUser.id })}::jsonb,
        updated_by = ${teamUser.id},
        updated_at = NOW()
    `);

    revalidatePath('/settings');
    return { success: true, maskedKey: maskApiKey(key) };
  } catch {
    return { error: 'Failed to generate API key.' };
  }
}

/**
 * Get the stored Project Tracking API key (masked for display).
 * Any team member can view the masked key.
 */
export async function getProjectTrackingApiKey() {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'project_tracking_api_key'))
      .limit(1);

    if (!row?.value?.key) {
      return { configured: false, maskedKey: null };
    }

    return { configured: true, maskedKey: maskApiKey(row.value.key) };
  } catch {
    return { configured: false, maskedKey: null };
  }
}

/**
 * Get the raw (unmasked) API key — used internally by the API route and CLAUDE.md generator.
 * NOT a server action — no 'use server' export, called server-side only.
 */
export async function getProjectTrackingApiKeyRaw() {
  try {
    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'project_tracking_api_key'))
      .limit(1);

    return row?.value?.key || null;
  } catch {
    return null;
  }
}

function maskApiKey(key) {
  if (!key || key.length < 12) return '****';
  return key.slice(0, 9) + '...' + key.slice(-4);
}
