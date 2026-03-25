'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { teamUsers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Disconnect Google Calendar from the current user's account.
 */
export async function disconnectGoogleCalendar() {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    await db
      .update(teamUsers)
      .set({
        googleRefreshToken: null,
        googleCalendarConnected: false,
        googleCalendarEmail: null,
        updatedAt: new Date(),
      })
      .where(eq(teamUsers.id, teamUser.id));

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    return { error: error.message || 'Failed to disconnect Google Calendar' };
  }
}

/**
 * Trigger a manual calendar sync directly (no HTTP call).
 */
export async function triggerCalendarSync() {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const { syncAllCalendars } = await import('@/lib/integrations/calendar-sync');
    const result = await syncAllCalendars();

    revalidatePath('/settings');
    revalidatePath('/calendar');
    revalidatePath('/');

    return {
      ok: true,
      synced: result.synced,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  } catch (error) {
    return { error: error.message || 'Failed to sync calendar' };
  }
}
