import { NextResponse } from 'next/server';
import { syncAllCalendars } from '@/lib/integrations/calendar-sync';

export async function GET(request) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await syncAllCalendars();

    return NextResponse.json({
      ok: true,
      synced: result.synced,
      errors: result.errors.length > 0 ? result.errors : undefined,
      users: result.users,
      disconnectedUsers: result.disconnectedUsers.length > 0 ? result.disconnectedUsers : undefined,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
