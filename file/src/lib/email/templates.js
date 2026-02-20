import { wrapInBrandedTemplate } from './branded-template';

/**
 * Welcome email sent to new clients after lead conversion.
 */
export function welcomeClient(clientName, portalUrl) {
  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">You now have access to your Botmakers Client Portal. This is where you can track your project progress, view proposals, manage invoices, and communicate with our team.</p>
    <p style="margin:0 0 16px; color:#333;">To log in, simply enter your email address on the portal login page and we'll send you a secure magic link — no password needed.</p>
    <p style="margin:0 0 16px; color:#333;">If you have any questions, reply to this email or reach out to our team. We're excited to work with you!</p>`;

  return wrapInBrandedTemplate({
    recipientName: clientName,
    bodyHtml,
    senderName: 'The BotMakers Team',
    senderTitle: null,
    ctaUrl: portalUrl,
    ctaText: 'Access Your Portal',
  });
}

/**
 * Email sent when a proposal is shared with a client/lead.
 */
export function proposalSent(recipientName, proposalTitle, portalUrl) {
  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">We've prepared a proposal for you: <strong style="color:#033457;">${proposalTitle}</strong></p>
    <p style="margin:0 0 16px; color:#333;">Please review the scope of work, deliverables, and pricing at your convenience. You can accept the proposal directly through your portal.</p>
    <p style="margin:0 0 16px; color:#333;">If you have any questions about this proposal, feel free to reply to this email. We look forward to working with you!</p>`;

  return wrapInBrandedTemplate({
    recipientName,
    bodyHtml,
    senderName: 'The BotMakers Team',
    senderTitle: null,
    ctaUrl: portalUrl,
    ctaText: 'View Proposal',
  });
}

/**
 * Email sent when an invoice is sent to a client.
 */
export function invoiceSent(recipientName, invoiceTitle, amount, dueDate, paymentUrl) {
  const formattedAmount = Number(amount).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  const formattedDue = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Upon receipt';

  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">You have a new invoice from Botmakers.ai:</p>
    <div style="border-left:4px solid #03FF00; background:#f8f9fa; padding:16px 20px; margin:20px 0; border-radius:0 8px 8px 0;">
      <h3 style="color:#033457; margin:0 0 8px; font-size:16px;">${invoiceTitle}</h3>
      <p style="margin:0 0 4px; color:#333;">Amount: <strong style="color:#033457;">${formattedAmount}</strong></p>
      <p style="margin:0; color:#333;">Due: ${formattedDue}</p>
    </div>
    <p style="margin:0 0 16px; color:#333;">If you have any questions about this invoice, reply to this email or reach out to our team.</p>`;

  return wrapInBrandedTemplate({
    recipientName,
    bodyHtml,
    senderName: 'The BotMakers Team',
    senderTitle: null,
    ctaUrl: paymentUrl,
    ctaText: 'Pay Now',
  });
}

/**
 * Payment receipt email sent to client after payment is received.
 */
export function paymentReceipt(recipientName, invoiceTitle, amount) {
  const formattedAmount = Number(amount).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">We've received your payment of <strong style="color:#033457;">${formattedAmount}</strong> for <strong style="color:#033457;">${invoiceTitle}</strong>.</p>
    <p style="margin:0 0 16px; color:#333;">This serves as your payment confirmation. No further action is needed.</p>
    <p style="margin:0 0 16px; color:#333;">If you have any questions, reply to this email or reach out to our team.</p>`;

  return wrapInBrandedTemplate({
    recipientName: recipientName || 'there',
    bodyHtml,
    senderName: 'The BotMakers Team',
    senderTitle: null,
  });
}
