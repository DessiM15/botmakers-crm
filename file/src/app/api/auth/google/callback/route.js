export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function htmlRedirect(url) {
  return new Response(
    `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${url}"></head><body><p>Redirecting to <a href="${url}">settings</a>...</p></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } }
  );
}

export async function GET(request) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${request.headers.get('host') || 'crm.botmakers.ai'}`;

  try {
    // Check Google Calendar env vars
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      return htmlRedirect(`${baseUrl}/settings?google_error=not_configured`);
    }

    // Lazy imports — avoid any module-level failures
    const { cookies } = await import('next/headers');
    const { requireTeam } = await import('@/lib/auth/helpers');

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

    // Lazy import googleapis
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

    // Save via Supabase admin client (more reliable than Drizzle on Vercel)
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await admin
      .from('team_users')
      .update({
        google_refresh_token: tokens.refresh_token,
        google_calendar_connected: true,
        google_calendar_email: googleEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamUser.id);

    return htmlRedirect(`${baseUrl}/settings?google_success=true`);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[Google Callback] Error:', err);
    const message = err.message?.includes('CB-AUTH') ? 'auth_required' : 'exchange_failed';
    return htmlRedirect(`${baseUrl}/settings?google_error=${message}`);
  }
}
