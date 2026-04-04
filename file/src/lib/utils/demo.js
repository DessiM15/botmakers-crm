import { cookies } from 'next/headers';

/**
 * Check if the current session is in demo mode.
 * Reads the `demo_mode` cookie. Returns false in contexts
 * without cookies (webhooks, cron jobs).
 */
export async function isDemoMode() {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('demo_mode')?.value === 'true';
  } catch {
    return false;
  }
}
