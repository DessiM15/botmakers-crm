import { db } from '@/lib/db/client';
import { notifications, teamUsers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from './client';

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
  const firstName = clientName.split(' ')[0];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const html = brandedEmail(
    'Progress Update',
    `Milestone Completed!`,
    `<p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
      Hi ${firstName}, great news! A milestone has been completed on your project:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="padding:16px;background-color:rgba(255,255,255,0.03);border-radius:8px;">
        <p style="margin:0 0 8px;color:#ffffff;font-size:16px;font-weight:600;">${milestoneName}</p>
        <p style="margin:0;color:#94a3b8;font-size:14px;">Project: ${projectName}</p>
      </td></tr>
    </table>
    ${actionButton('View Progress', `${siteUrl}/portal`)}`
  );

  await sendNotification('milestone_completed', {
    recipients: [clientEmail],
    subject: `Milestone Completed: ${milestoneName}`,
    html,
  });
}

/**
 * Question replied — email to client.
 */
export async function questionRepliedEmail(clientEmail, clientName, projectName, replyText) {
  const firstName = clientName.split(' ')[0];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const html = brandedEmail(
    'Reply',
    'Your Question Has Been Answered',
    `<p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
      Hi ${firstName}, the team has responded to your question about <strong style="color:#ffffff;">${projectName}</strong>:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="padding:16px;background-color:rgba(255,255,255,0.03);border-radius:8px;">
        <p style="margin:0;color:#ffffff;font-size:14px;line-height:1.6;">${replyText}</p>
      </td></tr>
    </table>
    ${actionButton('View in Portal', `${siteUrl}/portal`)}`
  );

  await sendEmail({ to: clientEmail, subject: `Reply: Your question about ${projectName}`, html });
}
