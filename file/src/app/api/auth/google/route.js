import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import { isGoogleCalendarConfigured, getGoogleAuthUrl } from '@/lib/integrations/google-calendar';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!isGoogleCalendarConfigured()) {
      return NextResponse.json(
        { error: 'Google Calendar integration not configured' },
        { status: 503 }
      );
    }

    const authUrl = await getGoogleAuthUrl(teamUser.id);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[Google Auth] Error:', error.message);
    return NextResponse.redirect(
      new URL('/settings?google_error=auth_required', process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.botmakers.ai')
    );
  }
}
