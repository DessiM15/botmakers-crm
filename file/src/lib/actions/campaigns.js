'use server';

import { db } from '@/lib/db/client';
import { campaigns, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { campaignCreateSchema, campaignUpdateSchema } from '@/lib/utils/validators';
import { getRandomEligibleRecipient, getClientCampaignContext, getLeadCampaignContext } from '@/lib/db/queries/campaigns';
import { generateCampaignEmailWithAI } from '@/lib/ai/client';
import { wrapInBrandedTemplate } from '@/lib/email/branded-template';

/**
 * Calculate the next send time based on campaign config.
 */
function calculateNextSendAt(campaign) {
  const now = new Date();
  const hour = campaign.sendHour ?? 15;
  const day = campaign.sendDay ?? 1;
  const freq = campaign.frequency || 'weekly';

  // Start from tomorrow at the send hour
  const next = new Date(now);
  next.setUTCHours(hour, 0, 0, 0);

  if (freq === 'daily') {
    // Next occurrence at send hour — if past today, go to tomorrow
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  if (freq === 'weekly') {
    // Find next occurrence of sendDay (0=Sun, 1=Mon, ...)
    const currentDay = next.getUTCDay();
    let diff = day - currentDay;
    if (diff < 0 || (diff === 0 && next <= now)) {
      diff += 7;
    }
    next.setUTCDate(next.getUTCDate() + diff);
    return next;
  }

  if (freq === 'biweekly') {
    const currentDay = next.getUTCDay();
    let diff = day - currentDay;
    if (diff < 0 || (diff === 0 && next <= now)) {
      diff += 14;
    }
    next.setUTCDate(next.getUTCDate() + diff);
    return next;
  }

  if (freq === 'monthly') {
    // Send on the (sendDay+1)th of next month — sendDay as 0-indexed day of month
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(Math.min(day + 1, 28)); // cap at 28 to avoid month rollover
    return next;
  }

  // Default fallback: 1 week
  next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

/**
 * Create a new campaign.
 */
export async function createCampaign(formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = campaignCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: 'CB-API-001: ' + parsed.error.issues[0].message };
    }

    const data = parsed.data;
    const nextSendAt = calculateNextSendAt(data);

    const [campaign] = await db
      .insert(campaigns)
      .values({
        name: data.name,
        audienceType: data.audienceType,
        type: data.type,
        frequency: data.frequency,
        sendDay: data.sendDay,
        sendHour: data.sendHour,
        subjectTemplate: data.subjectTemplate,
        promptContext: data.promptContext || null,
        triggerType: data.triggerType || null,
        triggerConfig: data.triggerConfig || null,
        nextSendAt,
        createdBy: teamUser.id,
      })
      .returning();

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'campaign.created',
      entityType: 'campaign',
      entityId: campaign.id,
      metadata: { name: data.name },
    });

    revalidatePath('/campaigns');
    return { success: true, campaignId: campaign.id };
  } catch (err) {
    return { error: 'CB-DB-001: Failed to create campaign.' };
  }
}

/**
 * Update an existing campaign.
 */
export async function updateCampaign(campaignId, formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = campaignUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: 'CB-API-001: ' + parsed.error.issues[0].message };
    }

    const data = parsed.data;

    // Fetch current campaign to merge for schedule calc
    const [existing] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!existing) {
      return { error: 'CB-DB-002: Campaign not found.' };
    }

    const merged = { ...existing, ...data };
    const nextSendAt = calculateNextSendAt(merged);

    const updateData = { ...data, nextSendAt, updatedAt: new Date() };

    await db.update(campaigns).set(updateData).where(eq(campaigns.id, campaignId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'campaign.updated',
      entityType: 'campaign',
      entityId: campaignId,
      metadata: { name: merged.name },
    });

    revalidatePath('/campaigns');
    revalidatePath(`/campaigns/${campaignId}`);
    return { success: true };
  } catch (err) {
    return { error: 'CB-DB-001: Failed to update campaign.' };
  }
}

/**
 * Pause a campaign.
 */
export async function pauseCampaign(campaignId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    await db
      .update(campaigns)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'campaign.paused',
      entityType: 'campaign',
      entityId: campaignId,
    });

    revalidatePath('/campaigns');
    revalidatePath(`/campaigns/${campaignId}`);
    return { success: true };
  } catch (err) {
    return { error: 'Failed to pause campaign.' };
  }
}

/**
 * Resume a paused campaign.
 */
export async function resumeCampaign(campaignId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    // Fetch to recalculate next send
    const [existing] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!existing) {
      return { error: 'CB-DB-002: Campaign not found.' };
    }

    const nextSendAt = calculateNextSendAt(existing);

    await db
      .update(campaigns)
      .set({ status: 'active', nextSendAt, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'campaign.resumed',
      entityType: 'campaign',
      entityId: campaignId,
    });

    revalidatePath('/campaigns');
    revalidatePath(`/campaigns/${campaignId}`);
    return { success: true };
  } catch (err) {
    return { error: 'Failed to resume campaign.' };
  }
}

/**
 * Archive a campaign.
 */
export async function archiveCampaign(campaignId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    await db
      .update(campaigns)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'campaign.archived',
      entityType: 'campaign',
      entityId: campaignId,
    });

    revalidatePath('/campaigns');
    revalidatePath(`/campaigns/${campaignId}`);
    return { success: true };
  } catch (err) {
    return { error: 'Failed to archive campaign.' };
  }
}

/**
 * Preview a campaign email using a random eligible recipient.
 */
export async function previewCampaignEmail(campaignId) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return { error: 'CB-DB-002: Campaign not found.' };
    }

    const audienceType = campaign.audienceType === 'all' ? 'clients' : campaign.audienceType;
    const recipient = await getRandomEligibleRecipient(audienceType);

    if (!recipient) {
      return { error: 'No eligible recipients found for preview.' };
    }

    let context = null;
    if (recipient.type === 'client') {
      context = await getClientCampaignContext(recipient.id);
    } else {
      context = await getLeadCampaignContext(recipient.id);
    }

    const aiResult = await generateCampaignEmailWithAI({
      recipientName: recipient.fullName,
      recipientCompany: recipient.company || recipient.companyName || '',
      audienceType: recipient.type,
      context: recipient.type === 'client' ? context : context,
      promptContext: campaign.promptContext,
      subjectTemplate: campaign.subjectTemplate,
    });

    const html = wrapInBrandedTemplate({
      recipientName: recipient.fullName,
      bodyHtml: aiResult.body_html,
      senderName: 'The BotMakers Team',
      senderTitle: '',
      unsubscribeUrl: '#unsubscribe-preview',
    });

    return {
      success: true,
      preview: {
        recipientName: recipient.fullName,
        recipientEmail: recipient.email,
        subject: aiResult.subject,
        bodyHtml: aiResult.body_html,
        fullHtml: html,
      },
    };
  } catch (err) {
    return { error: 'CB-INT-002: Failed to generate preview.' };
  }
}
