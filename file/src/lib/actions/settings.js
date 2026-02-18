'use server';

import { db } from '@/lib/db/client';
import { createAdminClient } from '@/lib/db/client';
import { teamUsers, systemSettings } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/auth/helpers';
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
