import { db } from '@/lib/db/client';
import { notifications, teamUsers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from './client';
import { wrapInBrandedTemplate } from './branded-template';

/**
 * Get all active team member emails.
 */
async function getTeamEmails() {
  const members = await db
    .select({ email: teamUsers.email })
    .from(teamUsers)
    .where(eq(teamUsers.isActive, true));
  return members.map((m) => m.email);
}

/**
 * Shared email wrapper: Botmakers-branded HTML email.
 */
function brandedEmail(subtitle, heading, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:'Inter Tight',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#111b2e;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#033457;padding:30px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">BotMakers</h1>
              <p style="margin:4px 0 0;color:#03FF00;font-size:12px;letter-spacing:2px;text-transform:uppercase;">${subtitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;font-weight:600;">${heading}</h2>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:#0a1628;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">BotMakers Inc. &bull; botmakers.ai</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function crmLink(path) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return `${base}${path}`;
}

function actionButton(text, url) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:8px 0 32px;">
      <a href="${url}" style="display:inline-block;background-color:#03FF00;color:#033457;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">${text}</a>
    </td></tr>
  </table>`;
}

/**
 * Send a notification and log it to the notifications table.
 */
export async function sendNotification(type, { recipients, subject, html, relatedLeadId, relatedProjectId, relatedInvoiceId }) {
  const emailList = Array.isArray(recipients) ? recipients : [recipients];

  for (const email of emailList) {
    const result = await sendEmail({ to: email, subject, html });

    await db.insert(notifications).values({
      type,
      channel: 'email',
      recipientEmail: email,
      subject,
      body: subject,
      relatedLeadId: relatedLeadId || null,
      relatedProjectId: relatedProjectId || null,
      relatedInvoiceId: relatedInvoiceId || null,
      sentAt: result.success ? new Date() : null,
      failedAt: result.success ? null : new Date(),
      errorMessage: result.success ? null : result.error,
    });
  }
}

/**
 * New lead alert — sent to team.
 */
export async function newLeadAlert(lead) {
  const teamEmails = await getTeamEmails();
  const html = brandedEmail(
    'New Lead',
    'New Lead Received',
    `<p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
      A new lead has been submitted:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="padding:16px;background-color:rgba(255,255,255,0.03);border-radius:8px;">
        <p style="margin:0 0 8px;color:#ffffff;font-size:16px;font-weight:600;">${lead.fullName}</p>
        <p style="margin:0 0 4px;color:#94a3b8;font-size:14px;">Email: ${lead.email}</p>
        ${lead.companyName ? `<p style="margin:0 0 4px;color:#94a3b8;font-size:14px;">Company: ${lead.companyName}</p>` : ''}
        ${lead.projectType ? `<p style="margin:0;color:#94a3b8;font-size:14px;">Project Type: ${lead.projectType}</p>` : ''}
      </td></tr>
    </table>
    ${actionButton('View Lead', crmLink(`/leads/${lead.id}`))}`
  );

  await sendNotification('lead_new', {
    recipients: teamEmails,
    subject: `New Lead: ${lead.fullName}`,
    html,
    relatedLeadId: lead.id,
  });
}

/**
 * Lead stage change — sent to team.
 */
export async function leadStageChange(lead, fromStage, toStage) {
  const teamEmails = await getTeamEmails();
  const html = brandedEmail(
    'Pipeline Update',
    'Lead Stage Changed',
    `<p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
      <strong style="color:#ffffff;">${lead.fullName}</strong> moved from
      <strong style="color:#03FF00;">${fromStage.replace(/_/g, ' ')}</strong> to
      <strong style="color:#03FF00;">${toStage.replace(/_/g, ' ')}</strong>.
    </p>
    ${actionButton('View Lead', crmLink(`/leads/${lead.id}`))}`
  );

  await sendNotification('lead_stage_change', {
    recipients: teamEmails,
    subject: `Lead Update: ${lead.fullName} → ${toStage.replace(/_/g, ' ')}`,
    html,
    relatedLeadId: lead.id,
  });
}

/**
 * Proposal accepted — sent to team.
 */
export async function proposalAccepted(proposal, clientName) {
  const teamEmails = await getTeamEmails();
  const html = brandedEmail(
    'Proposal Accepted',
    'Proposal Accepted!',
    `<p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
      <strong style="color:#ffffff;">${clientName}</strong> has accepted the proposal
      <strong style="color:#03FF00;">${proposal.title}</strong>.
    </p>
    ${actionButton('View Proposal', crmLink(`/proposals/${proposal.id}`))}`
  );

  await sendNotification('proposal_accepted', {
    recipients: teamEmails,
    subject: `Proposal Accepted: ${proposal.title}`,
    html,
  });
}

/**
 * Payment received — sent to team.
 */
export async function paymentReceived(invoice, payment) {
  const teamEmails = await getTeamEmails();
  const formattedAmount = Number(payment.amount).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
  });

  const html = brandedEmail(
    'Payment Received',
    'Payment Received!',
    `<p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
      Payment of <strong style="color:#03FF00;">${formattedAmount}</strong> received for
      <strong style="color:#ffffff;">${invoice.title}</strong>.
    </p>
    ${actionButton('View Invoice', crmLink(`/invoices/${invoice.id}`))}`
  );

  await sendNotification('payment_received', {
    recipients: teamEmails,
    subject: `Payment Received: ${formattedAmount} for ${invoice.title}`,
    html,
    relatedInvoiceId: invoice.id,
  });
}

/**
 * Client question — sent to team.
 */
export async function clientQuestion(project, question, clientName) {
  const teamEmails = await getTeamEmails();
  const html = brandedEmail(
    'Client Question',
    'New Question from Client',
    `<p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
      <strong style="color:#ffffff;">${clientName}</strong> asked a question about
      <strong style="color:#03FF00;">${project.name}</strong>:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="padding:16px;background-color:rgba(255,255,255,0.03);border-radius:8px;">
        <p style="margin:0;color:#ffffff;font-size:14px;line-height:1.6;font-style:italic;">"${question.questionText}"</p>
      </td></tr>
    </table>
    ${actionButton('Reply', crmLink(`/projects/${project.id}?tab=questions`))}`
  );

  await sendNotification('client_question', {
    recipients: teamEmails,
    subject: `Question from ${clientName} about ${project.name}`,
    html,
    relatedProjectId: project.id,
  });
}

/**
 * Milestone overdue alert — sent to team.
 */
export async function milestoneOverdue(overdueList) {
  if (overdueList.length === 0) return;

  const teamEmails = await getTeamEmails();
  const itemsHtml = overdueList.map((m) =>
    `<li style="margin:0 0 8px;color:#94a3b8;font-size:14px;">
      <strong style="color:#ffffff;">${m.title}</strong> in ${m.projectName}
      ${m.dueDate ? `(due ${new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''}
    </li>`
  ).join('');

  const html = brandedEmail(
    'Overdue Alert',
    `${overdueList.length} Milestone${overdueList.length > 1 ? 's' : ''} Overdue`,
    `<p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
      The following milestones are past their due date:
    </p>
    <ul style="margin:0 0 24px;padding-left:20px;">${itemsHtml}</ul>
    ${actionButton('View Projects', crmLink('/projects'))}`
  );

  await sendNotification('milestone_overdue', {
    recipients: teamEmails,
    subject: `${overdueList.length} Overdue Milestone${overdueList.length > 1 ? 's' : ''}`,
    html,
  });
}

/**
 * Stale lead alert — sent to team.
 */
export async function staleLeadAlert(staleLeads) {
  if (staleLeads.length === 0) return;

  const teamEmails = await getTeamEmails();
  const itemsHtml = staleLeads.map((l) =>
    `<li style="margin:0 0 8px;color:#94a3b8;font-size:14px;">
      <strong style="color:#ffffff;">${l.fullName}</strong>
      — ${l.pipelineStage.replace(/_/g, ' ')}
      ${l.lastContactedAt ? `(last contacted ${new Date(l.lastContactedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : '(never contacted)'}
    </li>`
  ).join('');

  const html = brandedEmail(
    'Stale Leads',
    `${staleLeads.length} Lead${staleLeads.length > 1 ? 's' : ''} Need Attention`,
    `<p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
      The following leads haven't been contacted recently:
    </p>
    <ul style="margin:0 0 24px;padding-left:20px;">${itemsHtml}</ul>
    ${actionButton('View Leads', crmLink('/leads'))}`
  );

  await sendNotification('lead_stale', {
    recipients: teamEmails,
    subject: `${staleLeads.length} Stale Lead${staleLeads.length > 1 ? 's' : ''} Need Follow-up`,
    html,
  });
}

/**
 * Milestone completed — email to client.
 */
export async function milestoneCompletedEmail(clientEmail, clientName, projectName, milestoneName) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">Great news! A milestone has been completed on your project:</p>
    <div style="border-left:4px solid #03FF00; background:#f8f9fa; padding:16px 20px; margin:20px 0; border-radius:0 8px 8px 0;">
      <h3 style="color:#033457; margin:0 0 8px; font-size:16px;">${milestoneName}</h3>
      <p style="margin:0; color:#333;">Project: ${projectName}</p>
    </div>`;

  const html = wrapInBrandedTemplate({
    recipientName: clientName,
    bodyHtml,
    senderName: 'The BotMakers Team',
    senderTitle: null,
    ctaUrl: `${siteUrl}/portal`,
    ctaText: 'View Progress',
  });

  await sendNotification('milestone_completed', {
    recipients: [clientEmail],
    subject: `Milestone Completed: ${milestoneName}`,
    html,
  });
}

/**
 * Project completed — email to client.
 */
export async function projectCompletedEmail(clientEmail, clientName, projectName) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">Your project <strong style="color:#033457;">${projectName}</strong> has been completed!</p>
    <p style="margin:0 0 16px; color:#333;">View the final deliverables in your portal.</p>`;

  const html = wrapInBrandedTemplate({
    recipientName: clientName,
    bodyHtml,
    senderName: 'The BotMakers Team',
    senderTitle: null,
    ctaUrl: `${siteUrl}/portal`,
    ctaText: 'View in Portal',
  });

  await sendNotification('milestone_completed', {
    recipients: [clientEmail],
    subject: `Project Completed: ${projectName}`,
    html,
  });
}

/**
 * Demo approved — email to client.
 */
export async function demoApprovedEmail(clientEmail, clientName, demoTitle, demoUrl, projectName) {
  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">A new demo is ready for your review on <strong style="color:#033457;">${projectName}</strong>:</p>
    <div style="border-left:4px solid #03FF00; background:#f8f9fa; padding:16px 20px; margin:20px 0; border-radius:0 8px 8px 0;">
      <h3 style="color:#033457; margin:0 0 8px; font-size:16px;">${demoTitle}</h3>
      <a href="${demoUrl}" style="color:#033457; font-size:14px;">${demoUrl}</a>
    </div>`;

  const html = wrapInBrandedTemplate({
    recipientName: clientName,
    bodyHtml,
    senderName: 'The BotMakers Team',
    senderTitle: null,
    ctaUrl: demoUrl,
    ctaText: 'View Demo',
  });

  await sendNotification('demo_shared', {
    recipients: [clientEmail],
    subject: `Demo Ready: ${demoTitle}`,
    html,
  });
}

/**
 * Service renewal alert — sent to team.
 */
export async function serviceRenewalAlert(services) {
  if (services.length === 0) return;

  const teamEmails = await getTeamEmails();
  const itemsHtml = services.map((s) =>
    `<tr>
      <td style="padding:8px 12px;color:#ffffff;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);">${s.serviceName}</td>
      <td style="padding:8px 12px;color:#94a3b8;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);">${s.clientName}</td>
      <td style="padding:8px 12px;color:#94a3b8;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);">${s.renewalDate ? new Date(s.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
      <td style="padding:8px 12px;color:#03FF00;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);">$${Number(s.monthlyCost).toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = brandedEmail(
    'Service Renewals',
    `${services.length} Service${services.length > 1 ? 's' : ''} Renewing Soon`,
    `<p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
      The following services are due for renewal within 7 days:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <thead>
        <tr>
          <th style="padding:8px 12px;color:#475569;font-size:12px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);">Service</th>
          <th style="padding:8px 12px;color:#475569;font-size:12px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);">Client</th>
          <th style="padding:8px 12px;color:#475569;font-size:12px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);">Renewal</th>
          <th style="padding:8px 12px;color:#475569;font-size:12px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);">Cost</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    ${actionButton('View Services', crmLink('/services'))}`
  );

  await sendNotification('lead_stale', {
    recipients: teamEmails,
    subject: `${services.length} Service${services.length > 1 ? 's' : ''} Renewing Soon`,
    html,
  });
}

/**
 * Question replied — email to client.
 */
export async function questionRepliedEmail(clientEmail, clientName, projectName, replyText) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">The team has responded to your question about <strong style="color:#033457;">${projectName}</strong>:</p>
    <div style="border-left:4px solid #03FF00; background:#f8f9fa; padding:16px 20px; margin:20px 0; border-radius:0 8px 8px 0;">
      <p style="margin:0; color:#333; line-height:1.6;">${replyText}</p>
    </div>`;

  const html = wrapInBrandedTemplate({
    recipientName: clientName,
    bodyHtml,
    senderName: 'The BotMakers Team',
    senderTitle: null,
    ctaUrl: `${siteUrl}/portal`,
    ctaText: 'View in Portal',
  });

  await sendEmail({ to: clientEmail, subject: `Reply: Your question about ${projectName}`, html });
}

/**
 * Meeting created alert — sent to team when a manual meeting is created.
 */
export async function meetingCreatedAlert({ title, attendeeName, attendeeEmail, startTime, endTime, meetingUrl, creatorName }) {
  const teamEmails = await getTeamEmails();

  const formattedStart = new Date(startTime).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    timeZone: 'America/Chicago',
  });
  const formattedEnd = new Date(endTime).toLocaleString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    timeZone: 'America/Chicago',
  });

  const attendeeSection = attendeeName
    ? `<p style="margin:0 0 4px;color:#94a3b8;font-size:14px;"><strong style="color:#ffffff;">Attendee:</strong> ${attendeeName}${attendeeEmail ? ` (${attendeeEmail})` : ''}</p>`
    : '';

  const joinButton = meetingUrl
    ? `<tr><td style="padding:8px 0;">
        <a href="${meetingUrl}" style="display:inline-block;background-color:#0d6efd;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:6px;">Join Meeting</a>
      </td></tr>`
    : '';

  const html = brandedEmail(
    'Meeting Created',
    title,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="padding:16px;background-color:rgba(255,255,255,0.03);border-radius:8px;">
        <p style="margin:0 0 8px;color:#ffffff;font-size:16px;font-weight:600;">${title}</p>
        <p style="margin:0 0 4px;color:#94a3b8;font-size:14px;"><strong style="color:#ffffff;">Created by:</strong> ${creatorName}</p>
        ${attendeeSection}
        <p style="margin:0 0 4px;color:#94a3b8;font-size:14px;"><strong style="color:#ffffff;">Start:</strong> ${formattedStart}</p>
        <p style="margin:0 0 4px;color:#94a3b8;font-size:14px;"><strong style="color:#ffffff;">End:</strong> ${formattedEnd}</p>
      </td></tr>
      ${joinButton}
    </table>
    ${actionButton('View Calendar', crmLink('/calendar'))}`
  );

  await sendNotification('meeting_created', {
    recipients: teamEmails,
    subject: `Meeting Created: ${title}`,
    html,
  });
}

/**
 * Meeting cancelled alert — sent to attendee when a meeting is cancelled.
 */
export async function meetingCancelledAttendeeEmail(attendeeEmail, attendeeName, meetingTitle, startTime) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const formattedStart = new Date(startTime).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    timeZone: 'America/Chicago',
  });

  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">We're reaching out to let you know that the following meeting has been cancelled:</p>
    <div style="border-left:4px solid #dc3545; background:#f8f9fa; padding:16px 20px; margin:20px 0; border-radius:0 8px 8px 0;">
      <h3 style="color:#033457; margin:0 0 8px; font-size:16px;">${meetingTitle}</h3>
      <p style="margin:0; color:#333;">Originally scheduled: ${formattedStart}</p>
    </div>
    <p style="margin:0 0 16px; color:#333;">If you'd like to reschedule, please don't hesitate to reach out.</p>`;

  const html = wrapInBrandedTemplate({
    recipientName: attendeeName || 'there',
    bodyHtml,
    senderName: 'The BotMakers Team',
    senderTitle: null,
    ctaUrl: siteUrl,
    ctaText: 'Visit BotMakers',
  });

  await sendEmail({ to: attendeeEmail, subject: `Meeting Cancelled: ${meetingTitle}`, html });
}

/**
 * Meeting invite — sent to attendee when a meeting is manually created with their email.
 */
export async function meetingInviteAttendeeEmail({ attendeeEmail, attendeeName, title, startTime, endTime, meetingUrl, creatorName }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const formattedStart = new Date(startTime).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    timeZone: 'America/Chicago',
  });
  const formattedEnd = new Date(endTime).toLocaleString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    timeZone: 'America/Chicago',
  });

  const joinSection = meetingUrl
    ? `<p style="margin:16px 0 0;"><a href="${meetingUrl}" style="display:inline-block;background-color:#033457;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:6px;">Join Meeting</a></p>`
    : '';

  const bodyHtml = `<p style="margin:0 0 16px; color:#333;">You've been invited to a meeting with the BotMakers team:</p>
    <div style="border-left:4px solid #033457; background:#f8f9fa; padding:16px 20px; margin:20px 0; border-radius:0 8px 8px 0;">
      <h3 style="color:#033457; margin:0 0 8px; font-size:16px;">${title}</h3>
      <p style="margin:0 0 4px; color:#333;"><strong>When:</strong> ${formattedStart} – ${formattedEnd}</p>
      <p style="margin:0; color:#333;"><strong>Scheduled by:</strong> ${creatorName}</p>
    </div>
    ${joinSection}
    <p style="margin:16px 0 0; color:#333;">If you need to reschedule, please reply to this email.</p>`;

  const html = wrapInBrandedTemplate({
    recipientName: attendeeName || 'there',
    bodyHtml,
    senderName: creatorName || 'The BotMakers Team',
    senderTitle: null,
    ctaUrl: meetingUrl || siteUrl,
    ctaText: meetingUrl ? 'Join Meeting' : 'Visit BotMakers',
  });

  await sendEmail({ to: attendeeEmail, subject: `Meeting Scheduled: ${title}`, html });
}

/**
 * Meeting booked alert — sent to team when a Cal.com meeting is booked.
 */
export async function meetingBookedAlert({ attendeeName, attendeeEmail, title, startTime, endTime, meetingUrl, matchedLeadName, matchedLeadId }) {
  const teamEmails = await getTeamEmails();

  const formattedStart = new Date(startTime).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    timeZone: 'America/Chicago',
  });
  const formattedEnd = new Date(endTime).toLocaleString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    timeZone: 'America/Chicago',
  });

  const leadSection = matchedLeadName
    ? `<p style="margin:0 0 4px;color:#94a3b8;font-size:14px;"><strong style="color:#03FF00;">Matched Lead:</strong> ${matchedLeadName}</p>`
    : `<p style="margin:0 0 4px;color:#475569;font-size:14px;font-style:italic;">No matching lead found</p>`;

  const joinButton = meetingUrl
    ? `<tr><td style="padding:8px 0;">
        <a href="${meetingUrl}" style="display:inline-block;background-color:#0d6efd;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:6px;">Join Meeting</a>
      </td></tr>`
    : '';

  const html = brandedEmail(
    'Meeting Booked',
    `New Meeting: ${title}`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="padding:16px;background-color:rgba(255,255,255,0.03);border-radius:8px;">
        <p style="margin:0 0 8px;color:#ffffff;font-size:16px;font-weight:600;">${title}</p>
        <p style="margin:0 0 4px;color:#94a3b8;font-size:14px;"><strong style="color:#ffffff;">Attendee:</strong> ${attendeeName} (${attendeeEmail})</p>
        <p style="margin:0 0 4px;color:#94a3b8;font-size:14px;"><strong style="color:#ffffff;">Start:</strong> ${formattedStart}</p>
        <p style="margin:0 0 4px;color:#94a3b8;font-size:14px;"><strong style="color:#ffffff;">End:</strong> ${formattedEnd}</p>
        ${leadSection}
      </td></tr>
      ${joinButton}
    </table>
    ${actionButton('View in CRM', crmLink('/meetings'))}`
  );

  await sendNotification('meeting_booked', {
    recipients: teamEmails,
    subject: `Meeting Booked: ${attendeeName} — ${title}`,
    html,
    relatedLeadId: matchedLeadId || null,
  });
}
