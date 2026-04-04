'use server';

import { db } from '@/lib/db/client';
import { emailDrafts, contacts, activityLog, leads, clients, teamUsers } from '@/lib/db/schema';
import { eq, desc, or, and, ilike, sql } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email/client';
import { wrapInBrandedTemplate } from '@/lib/email/branded-template';
import { saveDraftSchema } from '@/lib/utils/validators';

/**
 * Get contacts for the email generator sidebar panel.
 * Returns up to 100 contacts (50 leads + 50 clients).
 * Works without a search term (unlike getRecipients).
 */
export async function getContactsForPanel(search = '', typeFilter = 'all') {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const results = [];
    const pattern = search.trim() ? `%${search.trim()}%` : null;

    if (typeFilter === 'all' || typeFilter === 'lead') {
      const leadConditions = pattern
        ? or(
            ilike(leads.fullName, pattern),
            ilike(leads.email, pattern),
            ilike(leads.companyName, pattern)
          )
        : undefined;

      const matchedLeads = await db
        .select({
          id: leads.id,
          fullName: leads.fullName,
          email: leads.email,
          company: leads.companyName,
        })
        .from(leads)
        .where(leadConditions)
        .orderBy(desc(leads.createdAt))
        .limit(50);

      matchedLeads.forEach((l) => {
        results.push({
          id: l.id,
          name: l.fullName,
          email: l.email,
          company: l.company,
          type: 'lead',
        });
      });
    }

    if (typeFilter === 'all' || typeFilter === 'client') {
      const clientConditions = pattern
        ? or(
            ilike(clients.fullName, pattern),
            ilike(clients.email, pattern),
            ilike(clients.company, pattern)
          )
        : undefined;

      const matchedClients = await db
        .select({
          id: clients.id,
          fullName: clients.fullName,
          email: clients.email,
          company: clients.company,
        })
        .from(clients)
        .where(clientConditions)
        .orderBy(desc(clients.createdAt))
        .limit(50);

      matchedClients.forEach((c) => {
        results.push({
          id: c.id,
          name: c.fullName,
          email: c.email,
          company: c.company,
          type: 'client',
        });
      });
    }

    if (typeFilter === 'all' || typeFilter === 'teammate') {
      const teamWhere = pattern
        ? and(
            eq(teamUsers.isActive, true),
            or(ilike(teamUsers.fullName, pattern), ilike(teamUsers.email, pattern))
          )
        : eq(teamUsers.isActive, true);

      const matchedTeam = await db
        .select({
          id: teamUsers.id,
          fullName: teamUsers.fullName,
          email: teamUsers.email,
        })
        .from(teamUsers)
        .where(teamWhere)
        .orderBy(desc(teamUsers.createdAt))
        .limit(50);

      matchedTeam.forEach((t) => {
        results.push({
          id: t.id,
          name: t.fullName,
          email: t.email,
          company: null,
          type: 'teammate',
        });
      });
    }

    return { success: true, contacts: results };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to load contacts' };
  }
}

/**
 * Look up a single lead or client by ID and type.
 * Used when navigating from Contacts page → Email Generator.
 */
export async function getContactById(id, type) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    if (!id || !type) {
      return { error: 'CB-API-001: ID and type are required' };
    }

    if (type === 'lead') {
      const [lead] = await db
        .select({
          id: leads.id,
          fullName: leads.fullName,
          email: leads.email,
          company: leads.companyName,
          phone: leads.phone,
        })
        .from(leads)
        .where(eq(leads.id, id))
        .limit(1);

      if (!lead) return { error: 'CB-DB-002: Lead not found' };

      return {
        success: true,
        contact: {
          id: lead.id,
          name: lead.fullName,
          email: lead.email,
          company: lead.company,
          phone: lead.phone,
          type: 'lead',
        },
      };
    }

    if (type === 'client') {
      const [client] = await db
        .select({
          id: clients.id,
          fullName: clients.fullName,
          email: clients.email,
          company: clients.company,
          phone: clients.phone,
        })
        .from(clients)
        .where(eq(clients.id, id))
        .limit(1);

      if (!client) return { error: 'CB-DB-002: Client not found' };

      return {
        success: true,
        contact: {
          id: client.id,
          name: client.fullName,
          email: client.email,
          company: client.company,
          phone: client.phone,
          type: 'client',
        },
      };
    }

    if (type === 'teammate') {
      const [team] = await db
        .select({
          id: teamUsers.id,
          fullName: teamUsers.fullName,
          email: teamUsers.email,
        })
        .from(teamUsers)
        .where(eq(teamUsers.id, id))
        .limit(1);

      if (!team) return { error: 'CB-DB-002: Team member not found' };

      return {
        success: true,
        contact: {
          id: team.id,
          name: team.fullName,
          email: team.email,
          company: null,
          phone: null,
          type: 'teammate',
        },
      };
    }

    return { error: 'CB-API-001: Type must be "lead", "client", or "teammate"' };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to load contact' };
  }
}

/**
 * Search leads and clients for the recipient dropdown.
 */
export async function getRecipients(search) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const results = [];

    if (search && search.length >= 2) {
      const pattern = `%${search}%`;

      const matchedLeads = await db
        .select({
          id: leads.id,
          fullName: leads.fullName,
          email: leads.email,
          company: leads.companyName,
        })
        .from(leads)
        .where(
          or(
            ilike(leads.fullName, pattern),
            ilike(leads.email, pattern),
            ilike(leads.companyName, pattern)
          )
        )
        .limit(10);

      matchedLeads.forEach((l) => {
        results.push({
          id: l.id,
          name: l.fullName,
          email: l.email,
          company: l.company,
          type: 'lead',
        });
      });

      const matchedClients = await db
        .select({
          id: clients.id,
          fullName: clients.fullName,
          email: clients.email,
          company: clients.company,
        })
        .from(clients)
        .where(
          or(
            ilike(clients.fullName, pattern),
            ilike(clients.email, pattern),
            ilike(clients.company, pattern)
          )
        )
        .limit(10);

      matchedClients.forEach((c) => {
        results.push({
          id: c.id,
          name: c.fullName,
          email: c.email,
          company: c.company,
          type: 'client',
        });
      });

      const matchedTeam = await db
        .select({
          id: teamUsers.id,
          fullName: teamUsers.fullName,
          email: teamUsers.email,
        })
        .from(teamUsers)
        .where(
          and(
            eq(teamUsers.isActive, true),
            or(
              ilike(teamUsers.fullName, pattern),
              ilike(teamUsers.email, pattern)
            )
          )
        )
        .limit(10);

      matchedTeam.forEach((t) => {
        results.push({
          id: t.id,
          name: t.fullName,
          email: t.email,
          company: null,
          type: 'teammate',
        });
      });
    }

    return { success: true, recipients: results };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to search recipients' };
  }
}

/**
 * Send email from CRM via Resend + log to activity_log and contacts.
 */
export async function sendEmailFromCRM({ to, cc, subject, html, recipientLeadId, recipientClientId, recipientName }) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!to || !subject || !html) {
      return { error: 'CB-API-001: Recipient, subject, and body are required' };
    }

    const toList = Array.isArray(to) ? to : [to];
    const ccList = cc
      ? Array.isArray(cc) ? cc : cc.split(',').map((e) => e.trim()).filter(Boolean)
      : [];

    // Wrap body content in branded template
    const fullHtml = wrapInBrandedTemplate({
      recipientName: recipientName || '',
      bodyHtml: html,
      senderName: teamUser.fullName || 'The BotMakers Team',
      senderTitle: 'Co-Founder',
    });

    const result = await sendEmail({
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      subject,
      html: fullHtml,
      from: 'BotMakers <info@botmakers.ai>',
    });

    if (!result.success) {
      return { error: 'CB-INT-001: ' + (result.error || 'Failed to send email') };
    }

    // Log to contacts table
    const contactData = {
      type: 'email',
      subject,
      body: fullHtml,
      direction: 'outbound',
      createdBy: teamUser.id,
    };

    if (recipientLeadId) contactData.leadId = recipientLeadId;
    if (recipientClientId) contactData.clientId = recipientClientId;

    // Only insert if we have a lead or client reference
    if (recipientLeadId || recipientClientId) {
      await db.insert(contacts).values(contactData);
    }

    // Log to activity_log
    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'email.sent',
      entityType: recipientClientId ? 'client' : recipientLeadId ? 'lead' : 'email',
      entityId: recipientClientId || recipientLeadId || teamUser.id,
      metadata: {
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        subject,
      },
    });

    revalidatePath('/activity');
    revalidatePath('/email-generator');

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-INT-001: Failed to send email' };
  }
}

/**
 * Save or update an email draft.
 */
export async function saveDraft(formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = saveDraftSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: 'CB-API-001: ' + parsed.error.issues[0].message };
    }

    const data = parsed.data;
    const now = new Date();

    if (data.id) {
      // Update existing draft
      const [existing] = await db
        .select({ id: emailDrafts.id })
        .from(emailDrafts)
        .where(eq(emailDrafts.id, data.id))
        .limit(1);

      if (!existing) {
        return { error: 'CB-DB-002: Draft not found' };
      }

      await db
        .update(emailDrafts)
        .set({
          recipientEmail: data.recipientEmail,
          recipientName: data.recipientName || null,
          recipientLeadId: data.recipientLeadId || null,
          recipientClientId: data.recipientClientId || null,
          subject: data.subject || null,
          bodyHtml: data.bodyHtml || null,
          bodyText: data.bodyText || null,
          category: data.category || null,
          tone: data.tone || null,
          customInstructions: data.customInstructions || null,
          updatedAt: now,
        })
        .where(eq(emailDrafts.id, data.id));

      revalidatePath('/email-generator');
      return { success: true, id: data.id };
    }

    // Create new draft
    const [inserted] = await db
      .insert(emailDrafts)
      .values({
        recipientEmail: data.recipientEmail,
        recipientName: data.recipientName || null,
        recipientLeadId: data.recipientLeadId || null,
        recipientClientId: data.recipientClientId || null,
        subject: data.subject || null,
        bodyHtml: data.bodyHtml || null,
        bodyText: data.bodyText || null,
        category: data.category || null,
        tone: data.tone || null,
        customInstructions: data.customInstructions || null,
        createdBy: teamUser.id,
      })
      .returning();

    revalidatePath('/email-generator');
    return { success: true, id: inserted.id };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to save draft' };
  }
}

/**
 * Get all drafts for current user (most recent first).
 */
export async function getDrafts() {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const drafts = await db
      .select({
        id: emailDrafts.id,
        recipientEmail: emailDrafts.recipientEmail,
        recipientName: emailDrafts.recipientName,
        subject: emailDrafts.subject,
        category: emailDrafts.category,
        status: emailDrafts.status,
        createdAt: emailDrafts.createdAt,
        updatedAt: emailDrafts.updatedAt,
      })
      .from(emailDrafts)
      .where(eq(emailDrafts.status, 'draft'))
      .orderBy(desc(emailDrafts.updatedAt))
      .limit(50);

    return { success: true, drafts };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to load drafts' };
  }
}

/**
 * Load a single draft by ID.
 */
export async function loadDraft(id) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const [draft] = await db
      .select()
      .from(emailDrafts)
      .where(eq(emailDrafts.id, id))
      .limit(1);

    if (!draft) {
      return { error: 'CB-DB-002: Draft not found' };
    }

    return { success: true, draft };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to load draft' };
  }
}

/**
 * Delete a draft.
 */
export async function deleteDraft(id) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const [existing] = await db
      .select({ id: emailDrafts.id })
      .from(emailDrafts)
      .where(eq(emailDrafts.id, id))
      .limit(1);

    if (!existing) {
      return { error: 'CB-DB-002: Draft not found' };
    }

    await db.delete(emailDrafts).where(eq(emailDrafts.id, id));

    revalidatePath('/email-generator');
    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to delete draft' };
  }
}

/**
 * Mark a draft as sent.
 */
export async function markDraftSent(id) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    await db
      .update(emailDrafts)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(emailDrafts.id, id));

    revalidatePath('/email-generator');
    return { success: true };
  } catch (error) {
    return { error: 'CB-DB-001: Failed to update draft' };
  }
}
