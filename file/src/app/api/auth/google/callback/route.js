import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { teamUsers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

function htmlRedirect(url) {
  return new Response(
    `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${url}"></head><body><p>Redirecting to <a href="${url}">settings</a>...</p></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}

export async function GET(request) {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || 'crm.botmakers.ai';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;

  try {
    // Check Google Calendar env vars directly (avoid importing google-calendar.js at top level)
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      return htmlRedirect(`${baseUrl}/settings?google_error=not_configured`);
    }

    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return htmlRedirect(`${baseUrl}/settings?google_error=${error}`);
    }

    if (!code) {
      return htmlRedirect(`${baseUrl}/settings?google_error=no_code`);
    }

    // CSRF protection — state must match the current team user ID
    if (state !== teamUser.id) {
      return htmlRedirect(`${baseUrl}/settings?google_error=state_mismatch`);
    }

    // Lazy import googleapis to avoid module-level crash
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      return htmlRedirect(`${baseUrl}/settings?google_error=no_refresh_token`);
    }

    // Get the Google account email
    oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    const googleEmail = data.email;

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

    return htmlRedirect(`${baseUrl}/settings?google_success=true`);
  } catch (err) {
    console.error('[Google Callback] Error:', err);
    const message = err.message?.includes('CB-AUTH') ? 'auth_required' : 'exchange_failed';
    return htmlRedirect(`${baseUrl}/settings?google_error=${message}`);
  }
}
