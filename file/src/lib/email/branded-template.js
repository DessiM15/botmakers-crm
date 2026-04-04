/**
 * Branded email template wrapper for all client-facing CRM emails.
 * White background, navy header with logo, clean professional design.
 * All styles are inline for email client compatibility.
 */
export function wrapInBrandedTemplate({
  recipientName,
  bodyHtml,
  senderName = 'The BotMakers Team',
  senderTitle = 'Co-Founder',
  ctaUrl = null,
  ctaText = null,
}) {
  const firstName = recipientName ? recipientName.split(' ')[0] : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';

  const ctaBlock =
    ctaUrl && ctaText
      ? `<div style="text-align:center; margin:28px 0;">
      <a href="${ctaUrl}"
         style="display:inline-block; background-color:#03FF00; color:#033457;
                padding:14px 32px; text-decoration:none; font-weight:bold;
                border-radius:6px; font-size:15px;">
        ${ctaText}
      </a>
    </div>`
      : '';

  const senderTitleLine = senderTitle
    ? `<p style="margin:0; color:#666; font-size:13px;">${senderTitle}, BotMakers.ai</p>`
    : `<p style="margin:0; color:#666; font-size:13px;">BotMakers.ai</p>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f0f0f0; font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:600px; margin:0 auto; font-family:'Helvetica Neue',Arial,sans-serif; background-color:#ffffff;">

  <div style="background-color:#033457; padding:30px 40px; text-align:center;">
    <img src="https://botmakers.ai/assets/botmakers-white-green-logo.png"
         alt="Botmakers"
         style="height:40px;" />
  </div>

  <div style="padding:32px 40px; color:#1a1a1a; font-size:15px; line-height:1.7;">
    <p style="margin:0 0 16px;">${greeting}</p>

    ${bodyHtml}

    ${ctaBlock}

    <p style="margin:24px 0 4px;">Best regards,</p>
    <p style="margin:0; font-weight:bold; color:#033457;">${senderName}</p>
    ${senderTitleLine}
    <p style="margin:0; color:#666; font-size:13px;">&#x1F4F1; 832.790.5001 | &#x1F310; botmakers.ai</p>
  </div>

  <div style="background-color:#f5f5f5; padding:20px 40px; text-align:center; font-size:12px; color:#999;">
    <p style="margin:0;">&copy; 2026 BotMakers Inc. All Rights Reserved.</p>
    <p style="margin:4px 0 0;">
      <a href="https://botmakers.ai" style="color:#033457; text-decoration:none;">botmakers.ai</a>
    </p>
  </div>

</div>
</body>
</html>`;
}
