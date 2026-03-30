import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireTeam } from '@/lib/auth/helpers';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function GoogleCallbackPage({ searchParams }) {
  const params = await searchParams;
  const code = params?.code;
  const state = params?.state;
  const error = params?.error;

  if (error) {
    redirect(`/settings?google_error=${error}`);
  }

  if (!code) {
    redirect('/settings?google_error=no_code');
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    redirect('/settings?google_error=not_configured');
  }

  let teamUser;
  try {
    const cookieStore = await cookies();
    const result = await requireTeam(cookieStore);
    teamUser = result.teamUser;
  } catch {
    redirect('/settings?google_error=auth_required');
  }

  // CSRF protection
  if (state !== teamUser.id) {
    redirect('/settings?google_error=state_mismatch');
  }

  try {
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
      redirect('/settings?google_error=no_refresh_token');
    }

    // Get the Google account email
    oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Save via Supabase admin client
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
        google_calendar_email: data.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamUser.id);

    redirect('/settings?google_success=true');
  } catch (err) {
    // Next.js redirect() throws a special error — rethrow it
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    console.error('[Google Callback] Error:', err);
    redirect('/settings?google_error=exchange_failed');
  }
}
