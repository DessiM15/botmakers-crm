import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireTeam } from '@/lib/auth/helpers';
import { isGoogleCalendarConfigured, getGoogleAuthUrl } from '@/lib/integrations/google-calendar';

export const dynamic = 'force-dynamic';

export default async function GoogleAuthPage() {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!isGoogleCalendarConfigured()) {
      redirect('/settings?google_error=not_configured');
    }

    const authUrl = await getGoogleAuthUrl(teamUser.id);
    redirect(authUrl);
  } catch (err) {
    // Next.js redirect() throws a special error — rethrow it
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    if (process.env.NODE_ENV === 'development') console.error('[Google Auth] Error:', err.message);
    redirect('/settings?google_error=auth_required');
  }
}
