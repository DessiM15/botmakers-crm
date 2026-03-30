import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import {
  isGoogleCalendarConfigured,
  exchangeCodeForTokens,
  getGoogleUserEmail,
} from '@/lib/integrations/google-calendar';
import { db } from '@/lib/db/client';
import { teamUsers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request) {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || 'crm.botmakers.ai';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;

  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!isGoogleCalendarConfigured()) {
      return NextResponse.redirect(new URL('/settings?google_error=not_configured', baseUrl));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/settings?google_error=${error}`, baseUrl));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/settings?google_error=no_code', baseUrl));
    }

    // CSRF protection — state must match the current team user ID
    if (state !== teamUser.id) {
      return NextResponse.redirect(new URL('/settings?google_error=state_mismatch', baseUrl));
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL('/settings?google_error=no_refresh_token', baseUrl));
    }

    // Get the Google account email
    const googleEmail = await getGoogleUserEmail(tokens.refresh_token);

    // Save to team_users
    await db
      .update(teamUsers)
      .set({
        googleRefreshToken: tokens.refresh_token,
        googleCalendarConnected: true,
        googleCalendarEmail: googleEmail,
        updatedAt: new Date(),
      })
      .where(eq(teamUsers.id, teamUser.id));

    return NextResponse.redirect(new URL('/settings?google_success=true', baseUrl));
  } catch (err) {
    console.error('[Google Callback] Error:', err.message);
    const message = err.message?.includes('CB-AUTH') ? 'auth_required' : 'exchange_failed';
    return NextResponse.redirect(new URL(`/settings?google_error=${message}`, baseUrl));
  }
}
