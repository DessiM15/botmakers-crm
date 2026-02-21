import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { clients } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/client';
import { day2Guide } from '@/lib/email/templates';

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

    // Find clients invited 23-25 hours ago with exactly 1 invite sent
    const eligibleClients = await db
      .select({
        id: clients.id,
        email: clients.email,
        fullName: clients.fullName,
      })
      .from(clients)
      .where(sql`
        ${clients.portalInviteCount} = 1
        AND ${clients.portalInvitedAt} IS NOT NULL
        AND ${clients.portalInvitedAt} >= NOW() - INTERVAL '25 hours'
        AND ${clients.portalInvitedAt} <= NOW() - INTERVAL '23 hours'
        AND ${clients.portalAccessRevoked} = false
      `);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const portalUrl = `${siteUrl}/portal/login`;

    let sent = 0;
    const errors = [];

    for (const client of eligibleClients) {
      try {
        await sendEmail({
          to: client.email,
          subject: 'Quick Guide: Getting the Most From Your Portal',
          html: day2Guide(client, portalUrl),
        });
        sent++;
      } catch (err) {
        errors.push({ clientId: client.id, error: err.message });
      }
    }

    return NextResponse.json({
      ok: true,
      eligible: eligibleClients.length,
      sent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal error', message: err.message },
      { status: 500 }
    );
  }
}
