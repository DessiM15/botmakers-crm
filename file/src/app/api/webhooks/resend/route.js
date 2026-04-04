import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { campaignSends, clients, leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request) {
  try {
    const signingSecret = process.env.RESEND_WEBHOOK_SIGNING_SECRET;

    // Verify svix signature if secret is configured
    if (signingSecret) {
      const svixId = request.headers.get('svix-id');
      const svixTimestamp = request.headers.get('svix-timestamp');
      const svixSignature = request.headers.get('svix-signature');

      if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json({ error: 'Missing svix headers' }, { status: 401 });
      }

      // Verify timestamp is within 5 minutes
      const now = Math.floor(Date.now() / 1000);
      const ts = parseInt(svixTimestamp, 10);
      if (Math.abs(now - ts) > 300) {
        return NextResponse.json({ error: 'Timestamp expired' }, { status: 401 });
      }

      const body = await request.text();
      const crypto = require('crypto');

      // Svix signs: svixId.svixTimestamp.body
      const signedContent = `${svixId}.${svixTimestamp}.${body}`;
      const secretBytes = Buffer.from(signingSecret.replace('whsec_', ''), 'base64');
      const expectedSignature = crypto
        .createHmac('sha256', secretBytes)
        .update(signedContent)
        .digest('base64');

      // Check if any of the provided signatures match
      const signatures = svixSignature.split(' ');
      const valid = signatures.some((sig) => {
        const sigValue = sig.split(',')[1] || sig;
        return crypto.timingSafeEqual(
          Buffer.from(expectedSignature),
          Buffer.from(sigValue)
        );
      });

      if (!valid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      const event = JSON.parse(body);
      return await handleEvent(event);
    }

    // No secret configured — parse body directly (development)
    const event = await request.json();
    return await handleEvent(event);
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function handleEvent(event) {
  const type = event.type;
  const data = event.data;
  const messageId = data?.email_id;

  if (!messageId) {
    return NextResponse.json({ ok: true, skipped: 'no message id' });
  }

  // Find matching campaign_sends record
  const [send] = await db
    .select()
    .from(campaignSends)
    .where(eq(campaignSends.resendMessageId, messageId))
    .limit(1);

  if (!send) {
    return NextResponse.json({ ok: true, skipped: 'no matching send' });
  }

  if (type === 'email.delivered') {
    await db
      .update(campaignSends)
      .set({ status: 'delivered' })
      .where(eq(campaignSends.id, send.id));
  } else if (type === 'email.opened') {
    await db
      .update(campaignSends)
      .set({ status: 'opened', openedAt: new Date() })
      .where(eq(campaignSends.id, send.id));
  } else if (type === 'email.bounced') {
    await db
      .update(campaignSends)
      .set({ status: 'bounced' })
      .where(eq(campaignSends.id, send.id));
  } else if (type === 'email.complained') {
    await db
      .update(campaignSends)
      .set({ status: 'complained' })
      .where(eq(campaignSends.id, send.id));

    // Auto opt-out on complaint
    if (send.recipientType === 'client') {
      await db
        .update(clients)
        .set({ emailCampaignsOptedOut: true })
        .where(eq(clients.id, send.recipientId));
    } else if (send.recipientType === 'lead') {
      await db
        .update(leads)
        .set({ emailCampaignsOptedOut: true })
        .where(eq(leads.id, send.recipientId));
    }
  }

  return NextResponse.json({ ok: true, type, sendId: send.id });
}
