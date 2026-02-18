/**
 * Welcome email sent to new clients after lead conversion.
 */
export function welcomeClient(clientName, portalUrl) {
  const firstName = clientName.split(' ')[0];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Your Client Portal</title>
</head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:'Inter Tight',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#111b2e;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#033457;padding:30px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
                BotMakers
              </h1>
              <p style="margin:4px 0 0;color:#03FF00;font-size:12px;letter-spacing:2px;text-transform:uppercase;">
                Client Portal
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;font-weight:600;">
                Welcome, ${firstName}!
              </h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                You now have access to your Botmakers Client Portal. This is where you can track your project progress, view proposals, manage invoices, and communicate with our team.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${portalUrl}" style="display:inline-block;background-color:#03FF00;color:#033457;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">
                      Access Your Portal
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.6;">
                To log in, simply enter your email address on the portal login page and we'll send you a secure magic link — no password needed.
              </p>

              <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;">

              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
                If you have any questions, reply to this email or reach out to our team. We're excited to work with you!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0a1628;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                BotMakers Inc. &bull; botmakers.ai
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Email sent when a proposal is shared with a client/lead.
 */
export function proposalSent(recipientName, proposalTitle, portalUrl) {
  const firstName = recipientName.split(' ')[0];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Proposal from Botmakers.ai</title>
</head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:'Inter Tight',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#111b2e;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#033457;padding:30px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
                BotMakers
              </h1>
              <p style="margin:4px 0 0;color:#03FF00;font-size:12px;letter-spacing:2px;text-transform:uppercase;">
                Proposal
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;font-weight:600;">
                Hi ${firstName},
              </h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                We've prepared a proposal for you: <strong style="color:#ffffff;">${proposalTitle}</strong>
              </p>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                Please review the scope of work, deliverables, and pricing at your convenience. You can accept the proposal directly through your portal.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${portalUrl}" style="display:inline-block;background-color:#03FF00;color:#033457;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">
                      View Proposal
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;">

              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
                If you have any questions about this proposal, feel free to reply to this email. We look forward to working with you!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0a1628;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                BotMakers Inc. &bull; botmakers.ai
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Email sent when an invoice is sent to a client.
 */
export function invoiceSent(recipientName, invoiceTitle, amount, dueDate, paymentUrl) {
  const firstName = (recipientName || 'there').split(' ')[0];
  const formattedAmount = Number(amount).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  const formattedDue = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Upon receipt';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice from Botmakers.ai</title>
</head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:'Inter Tight',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#111b2e;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#033457;padding:30px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
                BotMakers
              </h1>
              <p style="margin:4px 0 0;color:#03FF00;font-size:12px;letter-spacing:2px;text-transform:uppercase;">
                Invoice
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;font-weight:600;">
                Hi ${firstName},
              </h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                You have a new invoice from Botmakers.ai:
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;background-color:rgba(255,255,255,0.03);border-radius:8px;">
                    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;font-weight:600;">
                      ${invoiceTitle}
                    </p>
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:14px;">
                      Amount: <strong style="color:#03FF00;">${formattedAmount}</strong>
                    </p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;">
                      Due: ${formattedDue}
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${paymentUrl}" style="display:inline-block;background-color:#03FF00;color:#033457;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">
                      Pay Now
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;">

              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
                If you have any questions about this invoice, reply to this email or reach out to our team.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0a1628;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                BotMakers Inc. &bull; botmakers.ai
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Payment receipt email sent to client after payment is received.
 */
export function paymentReceipt(recipientName, invoiceTitle, amount) {
  const firstName = (recipientName || 'there').split(' ')[0];
  const formattedAmount = Number(amount).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Received</title>
</head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:'Inter Tight',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#111b2e;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#033457;padding:30px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
                BotMakers
              </h1>
              <p style="margin:4px 0 0;color:#03FF00;font-size:12px;letter-spacing:2px;text-transform:uppercase;">
                Payment Receipt
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;font-weight:600;">
                Thank you, ${firstName}!
              </h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                We've received your payment of <strong style="color:#03FF00;">${formattedAmount}</strong> for <strong style="color:#ffffff;">${invoiceTitle}</strong>.
              </p>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                This serves as your payment confirmation. No further action is needed.
              </p>

              <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;">

              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
                If you have any questions, reply to this email or reach out to our team.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0a1628;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                BotMakers Inc. &bull; botmakers.ai
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
