import { wrapInBrandedTemplate } from './branded-template';

/**
 * Portal invite email sent to clients to grant portal access.
 */
export function portalInvite(client, projects, portalUrl) {
  const featureList = `
    <ul style="margin:0 0 16px; padding-left:20px; color:#333;">
      <li style="margin-bottom:6px;">Track your project progress in real time</li>
      <li style="margin-bottom:6px;">View and sign proposals</li>
      <li style="margin-bottom:6px;">Ask questions and get responses from our team</li>
      <li style="margin-bottom:6px;">Review demos and deliverables</li>
      <li style="margin-bottom:6px;">View invoices and make payments</li>
    </ul>`;

  let projectSection = '';
  if (projects && projects.length > 0) {
    const projectItems = projects
      .map(
        (p) =>
          `<li style="margin-bottom:4px; color:#333;"><strong style="color:#033457;">${p.name}</strong> — ${(p.status || 'draft').replace(/_/g, ' ')}</li>`
      )
      .join('');
    projectSection = `
      <p style="margin:0 0 8px; color:#333; font-weight:600;">Your current projects:</p>
      <ul style="margin:0 0 16px; padding-left:20px;">${projectItems}</ul>`;
  }

  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">Your BotMakers client portal is ready! Here's what you can do:</p>
    ${featureList}
    ${projectSection}
    <p style="margin:0 0 16px; color:#333;">To log in, simply click the button below and enter your email address. We'll send you a secure magic link — no password needed.</p>`;

  return wrapInBrandedTemplate({
    recipientName: client.fullName,
    bodyHtml,
    senderName: 'The BotMakers Team',
    senderTitle: null,
    ctaUrl: portalUrl,
    ctaText: 'Access Your Portal',
  });
}

/**
 * Day 2 guide email — quick tips for new portal users.
 */
export function day2Guide(client, portalUrl) {
  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">Just a quick follow-up to make sure you're getting the most out of your client portal.</p>
    <div style="border-left:4px solid #03FF00; background:#f8f9fa; padding:16px 20px; margin:20px 0; border-radius:0 8px 8px 0;">
      <h3 style="color:#033457; margin:0 0 12px; font-size:16px;">Quick Tips</h3>
      <p style="margin:0 0 8px; color:#333;"><strong>Check your project</strong> — See the latest milestones and progress updates.</p>
      <p style="margin:0 0 8px; color:#333;"><strong>Ask a question</strong> — Use the Q&A section on your project page to reach our team directly.</p>
      <p style="margin:0 0 8px; color:#333;"><strong>Review demos</strong> — When we share preview links, you'll find them right in your project.</p>
      <p style="margin:0; color:#333;"><strong>Stay notified</strong> — We'll email you when there are important updates.</p>
    </div>
    <p style="margin:0 0 16px; color:#333;">If you haven't logged in yet, just click the button below and enter your email. No password needed!</p>`;

  return wrapInBrandedTemplate({
    recipientName: client.fullName,
    bodyHtml,
    senderName: 'The BotMakers Team',
    senderTitle: null,
    ctaUrl: portalUrl,
    ctaText: 'Go to Your Portal',
  });
}

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
