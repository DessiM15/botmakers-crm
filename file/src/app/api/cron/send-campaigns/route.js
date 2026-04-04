import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { campaigns, campaignSends, activityLog, systemSettings } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getDueCampaigns, getEligibleClients, getEligibleLeads, getClientCampaignContext, getLeadCampaignContext } from '@/lib/db/queries/campaigns';
import { generateCampaignEmailWithAI } from '@/lib/ai/client';
import { wrapInBrandedTemplate } from '@/lib/email/branded-template';
import { sendEmail } from '@/lib/email/client';
import { generateUnsubscribeUrl } from '@/lib/utils/formatters';

export const maxDuration = 300; // 5 min for Vercel Pro

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

    // Check global pause
    let campaignsPaused = false;
    try {
      const [setting] = await db
        .select({ value: systemSettings.value })
        .from(systemSettings)
        .where(sql`${systemSettings.key} = 'campaigns_paused'`)
        .limit(1);
      if (setting?.value === true) {
        campaignsPaused = true;
      }
    } catch {
      // Not configured, continue
    }

    if (campaignsPaused) {
      return NextResponse.json({ ok: true, message: 'Campaigns globally paused', sent: 0 });
    }

    const dueCampaigns = await getDueCampaigns();

    if (dueCampaigns.length === 0) {
      return NextResponse.json({ ok: true, message: 'No campaigns due', sent: 0 });
    }

    let totalSent = 0;

    for (const campaign of dueCampaigns) {
      let recipients = [];

      if (campaign.audienceType === 'clients' || campaign.audienceType === 'all') {
        const eligibleClients = await getEligibleClients();
        recipients.push(
          ...eligibleClients.map((c) => ({
            id: c.id,
            type: 'client',
            email: c.email,
            fullName: c.fullName,
            company: c.company,
          }))
        );
      }

      if (campaign.audienceType === 'leads' || campaign.audienceType === 'all') {
        const eligibleLeads = await getEligibleLeads();
        recipients.push(
          ...eligibleLeads.map((l) => ({
            id: l.id,
            type: 'lead',
            email: l.email,
            fullName: l.fullName,
            company: l.companyName,
          }))
        );
      }

      // Cap at 50 per campaign per run
      recipients = recipients.slice(0, 50);

      for (const recipient of recipients) {
        try {
          // Gather context
          let context = null;
          if (recipient.type === 'client') {
            context = await getClientCampaignContext(recipient.id);
          } else {
            context = await getLeadCampaignContext(recipient.id);
          }

          // Generate AI content
          const aiResult = await generateCampaignEmailWithAI({
            recipientName: recipient.fullName,
            recipientCompany: recipient.company || '',
            audienceType: recipient.type,
            context,
            promptContext: campaign.promptContext,
            subjectTemplate: campaign.subjectTemplate,
          });

          const unsubscribeUrl = generateUnsubscribeUrl(recipient.type, recipient.id);

          const html = wrapInBrandedTemplate({
            recipientName: recipient.fullName,
            bodyHtml: aiResult.body_html,
            senderName: 'The BotMakers Team',
            senderTitle: '',
            unsubscribeUrl,
          });

          // Send email
          const emailResult = await sendEmail({
            to: recipient.email,
            subject: aiResult.subject,
            html,
          });

          // Insert campaign_sends record
          await db.insert(campaignSends).values({
            campaignId: campaign.id,
            recipientId: recipient.id,
            recipientType: recipient.type,
            recipientEmail: recipient.email,
            recipientName: recipient.fullName,
            subject: aiResult.subject,
            bodyHtml: aiResult.body_html,
            status: emailResult.success ? 'sent' : 'bounced',
            resendMessageId: emailResult.id || null,
            sentAt: emailResult.success ? new Date() : null,
          });

          if (emailResult.success) {
            totalSent++;
          }

          // 100ms delay between sends
          await new Promise((r) => setTimeout(r, 100));
        } catch {
          // Skip individual recipient errors, continue
        }
      }

      // Update campaign: lastGeneratedAt and nextSendAt
      const nextSendAt = calculateNextSendAt(campaign);
      await db
        .update(campaigns)
        .set({
          lastGeneratedAt: new Date(),
          nextSendAt,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaign.id));
    }

    // Log activity
    if (totalSent > 0) {
      await db.insert(activityLog).values({
        actorType: 'system',
        action: 'campaign.batch_sent',
        entityType: 'campaign',
        entityId: dueCampaigns[0].id,
        metadata: { campaignsProcessed: dueCampaigns.length, totalSent },
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Processed ${dueCampaigns.length} campaigns, sent ${totalSent} emails`,
      campaignsProcessed: dueCampaigns.length,
      sent: totalSent,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * Calculate the next send time based on campaign config.
 */
function calculateNextSendAt(campaign) {
  const now = new Date();
  const hour = campaign.sendHour ?? 15;
  const day = campaign.sendDay ?? 1;
  const freq = campaign.frequency || 'weekly';

  const next = new Date(now);
  next.setUTCHours(hour, 0, 0, 0);

  if (freq === 'daily') {
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (freq === 'weekly') {
    const currentDay = next.getUTCDay();
    let diff = day - currentDay;
    if (diff < 0 || (diff === 0 && next <= now)) diff += 7;
    next.setUTCDate(next.getUTCDate() + diff);
    return next;
  }

  if (freq === 'biweekly') {
    const currentDay = next.getUTCDay();
    let diff = day - currentDay;
    if (diff < 0 || (diff === 0 && next <= now)) diff += 14;
    next.setUTCDate(next.getUTCDate() + diff);
    return next;
  }

  if (freq === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(Math.min(day + 1, 28));
    return next;
  }

  next.setUTCDate(next.getUTCDate() + 7);
  return next;
}
