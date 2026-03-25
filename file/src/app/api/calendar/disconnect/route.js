import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { teamUsers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect Google Calendar' },
      { status: 500 }
    );
  }
}
