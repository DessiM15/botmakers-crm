import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { clients, leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const token = searchParams.get('token');

    if (!type || !id || !token) {
      return htmlResponse('Invalid Link', 'This unsubscribe link is invalid or incomplete.');
    }

    // Verify HMAC token
    const secret = process.env.CRON_SECRET || 'fallback-secret';
    const payload = `${type}:${id}`;
    const expectedToken = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const tokenValid = crypto.timingSafeEqual(
      Buffer.from(expectedToken, 'hex'),
      Buffer.from(token, 'hex')
    );

    if (!tokenValid) {
      return htmlResponse('Invalid Link', 'This unsubscribe link is invalid or has expired.');
    }

    // Opt out the recipient
    if (type === 'client') {
      const [updated] = await db
        .update(clients)
        .set({ emailCampaignsOptedOut: true })
        .where(eq(clients.id, id))
        .returning({ id: clients.id, fullName: clients.fullName });

      if (!updated) {
        return htmlResponse('Not Found', 'We could not find your account.');
      }

      return htmlResponse(
        'Unsubscribed',
        `You have been unsubscribed from BotMakers marketing emails. You will still receive important account notifications.`
      );
    }

    if (type === 'lead') {
      const [updated] = await db
        .update(leads)
        .set({ emailCampaignsOptedOut: true })
        .where(eq(leads.id, id))
        .returning({ id: leads.id, fullName: leads.fullName });

      if (!updated) {
        return htmlResponse('Not Found', 'We could not find your record.');
      }

      return htmlResponse(
        'Unsubscribed',
        `You have been unsubscribed from BotMakers marketing emails.`
      );
    }

    return htmlResponse('Invalid Link', 'Unrecognized recipient type.');
  } catch (error) {
    return htmlResponse('Error', 'Something went wrong. Please try again later.');
  }
}

function htmlResponse(title, message) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — BotMakers</title>
  <style>
    body {
      margin: 0; padding: 0;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #f0f0f0;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #fff; border-radius: 12px;
      padding: 48px; max-width: 480px; width: 90%;
      text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .logo { height: 32px; margin-bottom: 24px; }
    h1 { color: #033457; font-size: 24px; margin: 0 0 12px; }
    p { color: #666; font-size: 15px; line-height: 1.6; margin: 0; }
    a { color: #033457; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <img src="https://botmakers.ai/assets/botmakers-dark-blue-green-logo.png" alt="BotMakers" class="logo" />
    <h1>${title}</h1>
    <p>${message}</p>
    <p style="margin-top:24px;"><a href="https://botmakers.ai">Visit botmakers.ai</a></p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
