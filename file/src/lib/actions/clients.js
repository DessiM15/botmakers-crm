'use server';

import { db } from '@/lib/db/client';
import { createAdminClient } from '@/lib/db/client';
import { clients, leads, activityLog, contacts, proposals, proposalLineItems, projects, projectPhases, projectMilestones, projectRepos, projectDemos, projectQuestions, invoices, invoiceLineItems, payments, emailDrafts, notifications, teamUsers } from '@/lib/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { clientCreateSchema, clientUpdateSchema } from '@/lib/utils/validators';
import { sendEmail } from '@/lib/email/client';
import { welcomeClient, portalInvite } from '@/lib/email/templates';

/**
 * Create a new client manually (not from lead conversion).
 */
export async function createClient(formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = clientCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: 'CB-API-001: ' + parsed.error.issues[0].message };
    }

    const data = parsed.data;

    // Check for existing client with same email
    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.email, data.email.toLowerCase()))
      .limit(1);

    if (existing) {
      return { error: 'A client with this email already exists', existingId: existing.id };
    }

    const [newClient] = await db
      .insert(clients)
      .values({
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        company: data.company || null,
        phone: data.phone || null,
        createdBy: teamUser.id,
      })
      .returning();

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'client.created',
      entityType: 'client',
      entityId: newClient.id,
      metadata: { name: newClient.fullName },
    });

    revalidatePath('/clients');
    revalidatePath(`/clients/${newClient.id}`);

    return { success: true, client: newClient };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to create client' };
  }
}

/**
 * Update client info.
 */
export async function updateClient(clientId, formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = clientUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: 'CB-API-001: ' + parsed.error.issues[0].message };
    }

    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!existing) {
      return { error: 'CB-DB-002: Client not found' };
    }

    const data = parsed.data;
    const updateData = { updatedAt: new Date() };

    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.company !== undefined) updateData.company = data.company || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    await db.update(clients).set(updateData).where(eq(clients.id, clientId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'client.updated',
      entityType: 'client',
      entityId: clientId,
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath('/clients');

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to update client' };
  }
}

/**
 * Delete a client (hard delete).
 */
export async function deleteClient(clientId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [existing] = await db
      .select({ id: clients.id, fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!existing) {
      return { error: 'CB-DB-002: Client not found' };
    }

    // Get related project IDs for deeper cascade
    const clientProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.clientId, clientId));
    const projectIds = clientProjects.map((p) => p.id);

    // Get related proposal/invoice IDs
    const clientProposals = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(eq(proposals.clientId, clientId));
    const proposalIds = clientProposals.map((p) => p.id);

    const clientInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.clientId, clientId));
    const invoiceIds = clientInvoices.map((i) => i.id);

    // Delete in dependency order (deepest children first)
    if (projectIds.length > 0) {
      await db.delete(projectMilestones).where(inArray(projectMilestones.projectId, projectIds));
      await db.delete(projectPhases).where(inArray(projectPhases.projectId, projectIds));
      await db.delete(projectRepos).where(inArray(projectRepos.projectId, projectIds));
      await db.delete(projectDemos).where(inArray(projectDemos.projectId, projectIds));
      await db.delete(projectQuestions).where(inArray(projectQuestions.projectId, projectIds));
    }
    if (proposalIds.length > 0) {
      await db.delete(proposalLineItems).where(inArray(proposalLineItems.proposalId, proposalIds));
    }
    if (invoiceIds.length > 0) {
      await db.delete(invoiceLineItems).where(inArray(invoiceLineItems.invoiceId, invoiceIds));
      await db.delete(payments).where(inArray(payments.invoiceId, invoiceIds));
    }

    // Delete direct children of client
    await db.delete(contacts).where(eq(contacts.clientId, clientId));
    await db.delete(emailDrafts).where(eq(emailDrafts.recipientClientId, clientId));
    await db.delete(notifications).where(eq(notifications.relatedInvoiceId, clientId));
    if (invoiceIds.length > 0) {
      await db.delete(invoices).where(inArray(invoices.id, invoiceIds));
    }
    if (proposalIds.length > 0) {
      await db.delete(proposals).where(inArray(proposals.id, proposalIds));
    }
    if (projectIds.length > 0) {
      await db.delete(projects).where(inArray(projects.id, projectIds));
    }

    // Clear lead conversion reference
    await db
      .update(leads)
      .set({ convertedToClientId: null })
      .where(eq(leads.convertedToClientId, clientId));

    // Delete the client
    await db.delete(clients).where(eq(clients.id, clientId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'client.deleted',
      entityType: 'client',
      entityId: clientId,
      metadata: { name: existing.fullName },
    });

    revalidatePath('/clients');
    revalidatePath('/projects');
    revalidatePath('/proposals');
    revalidatePath('/invoices');

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to delete client' };
  }
}

/**
 * Convert a lead to a client (WF-4).
 * 1. Check if client with same email exists
 * 2. Insert client record from lead data
 * 3. Create Supabase Auth account
 * 4. Update lead: converted_to_client_id, pipeline_stage = 'contract_signed'
 * 5. Send welcome email
 * 6. Log to activity_log
 */
export async function convertLeadToClient(leadId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    // Fetch lead
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return { error: 'CB-DB-002: Lead not found' };
    }

    if (lead.convertedToClientId) {
      return { error: 'This lead has already been converted to a client', existingClientId: lead.convertedToClientId };
    }

    // Check for existing client with same email
    const [existingClient] = await db
      .select({ id: clients.id, fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.email, lead.email.toLowerCase()))
      .limit(1);

    let clientId;

    if (existingClient) {
      // Link to existing client
      clientId = existingClient.id;
    } else {
      // Create new client
      const [newClient] = await db
        .insert(clients)
        .values({
          fullName: lead.fullName,
          email: lead.email.toLowerCase(),
          company: lead.companyName || null,
          phone: lead.phone || null,
          createdBy: teamUser.id,
        })
        .returning();

      clientId = newClient.id;

      // Create Supabase Auth account for portal access
      const adminClient = createAdminClient();
      const { data: authData, error: authError } =
        await adminClient.auth.admin.createUser({
          email: lead.email.toLowerCase(),
          email_confirm: true,
          user_metadata: {
            full_name: lead.fullName,
            role: 'client',
          },
        });

      if (authError) {
        // If user already exists in auth, try to get them
        if (authError.message?.includes('already been registered')) {
          const { data: listData } = await adminClient.auth.admin.listUsers();
          const existingAuthUser = listData?.users?.find(
            (u) => u.email === lead.email.toLowerCase()
          );
          if (existingAuthUser) {
            await db
              .update(clients)
              .set({ authUserId: existingAuthUser.id })
              .where(eq(clients.id, clientId));
          }
        }
        // Don't fail the whole conversion if auth fails
      } else if (authData?.user) {
        await db
          .update(clients)
          .set({ authUserId: authData.user.id })
          .where(eq(clients.id, clientId));
      }

      // Log client creation
      await db.insert(activityLog).values({
        actorId: teamUser.id,
        actorType: 'team',
        action: 'client.created',
        entityType: 'client',
        entityId: clientId,
        metadata: { name: lead.fullName, fromLead: leadId },
      });
    }

    // Update lead
    const now = new Date();
    await db
      .update(leads)
      .set({
        convertedToClientId: clientId,
        pipelineStage: 'contract_signed',
        pipelineStageChangedAt: now,
        updatedAt: now,
      })
      .where(eq(leads.id, leadId));

    // Log conversion
    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'lead.converted',
      entityType: 'lead',
      entityId: leadId,
      metadata: { clientId, clientName: lead.fullName },
    });

    // Send welcome email (don't block on failure)
    const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/portal/login`;
    sendEmail({
      to: lead.email,
      subject: 'Welcome to Your Botmakers Client Portal',
      html: welcomeClient(lead.fullName, portalUrl),
    }).catch(() => {
      // Email failure is non-critical
    });

    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/pipeline');
    revalidatePath('/clients');
    revalidatePath('/');

    return { success: true, clientId };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to convert lead to client' };
  }
}

/**
 * Send portal invite to a client.
 * Creates Supabase Auth user if needed, sends branded invite email.
 */
export async function sendPortalInvite(clientId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    // Fetch client
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return { error: 'CB-DB-002: Client not found' };
    }

    if (!client.email) {
      return { error: 'CB-API-001: Client has no email address' };
    }

    // Check if email belongs to a team member
    const [teamMatch] = await db
      .select({ id: teamUsers.id })
      .from(teamUsers)
      .where(eq(teamUsers.email, client.email.toLowerCase()))
      .limit(1);

    if (teamMatch) {
      return { error: 'This email belongs to a team member. Portal invites are for clients only.' };
    }

    // Rate limit: max 3 invites per 24 hours
    if (client.portalInviteCount > 0 && client.portalInvitedAt) {
      const hoursSinceLastInvite = (Date.now() - new Date(client.portalInvitedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastInvite < 24 && client.portalInviteCount >= 3) {
        return { error: 'CB-API-003: Too many invites sent in the last 24 hours. Please wait.' };
      }
    }

    // Check for projects (warn but don't block)
    const clientProjects = await db
      .select({ id: projects.id, name: projects.name, status: projects.status })
      .from(projects)
      .where(eq(projects.clientId, clientId));

    let warning = null;
    if (clientProjects.length === 0) {
      warning = 'Client has no projects yet. The portal will show an empty state.';
    }

    // Create Supabase Auth user if needed
    let authUserId = client.authUserId;
    if (!authUserId) {
      const adminClient = createAdminClient();
      const { data: authData, error: authError } =
        await adminClient.auth.admin.createUser({
          email: client.email.toLowerCase(),
          email_confirm: true,
          user_metadata: {
            full_name: client.fullName,
            role: 'client',
          },
        });

      if (authError) {
        if (authError.message?.includes('already been registered')) {
          const { data: listData } = await adminClient.auth.admin.listUsers();
          const existingAuthUser = listData?.users?.find(
            (u) => u.email === client.email.toLowerCase()
          );
          if (existingAuthUser) {
            authUserId = existingAuthUser.id;
          }
        } else {
          return { error: 'Failed to create portal account: ' + authError.message };
        }
      } else if (authData?.user) {
        authUserId = authData.user.id;
      }
    }

    // Send invite email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const portalUrl = `${siteUrl}/portal/login`;

    const emailResult = await sendEmail({
      to: client.email,
      subject: "Welcome! Here's Your Portal Access",
      html: portalInvite(client, clientProjects, portalUrl),
    });

    if (!emailResult.success) {
      return { error: 'CB-INT-001: Failed to send invite email — ' + (emailResult.error || 'unknown error') };
    }

    // Update client record
    const now = new Date();
    await db
      .update(clients)
      .set({
        authUserId: authUserId || client.authUserId,
        portalInvitedAt: now,
        portalInviteCount: sql`COALESCE(portal_invite_count, 0) + 1`,
        portalAccessRevoked: false,
        updatedAt: now,
      })
      .where(eq(clients.id, clientId));

    // Log activity
    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'portal.invite_sent',
      entityType: 'client',
      entityId: clientId,
      metadata: { clientName: client.fullName, sentBy: teamUser.fullName },
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath('/clients');

    return { success: true, sentAt: now.toISOString(), authUserId, warning };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-INT-001: Failed to send portal invite' };
  }
}

/**
 * Revoke portal access for a client.
 * Bans the Supabase Auth user so they can't log in.
 */
export async function revokePortalAccess(clientId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [client] = await db
      .select({ id: clients.id, authUserId: clients.authUserId, fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return { error: 'CB-DB-002: Client not found' };
    }

    // Ban auth user if they exist
    if (client.authUserId) {
      const adminClient = createAdminClient();
      await adminClient.auth.admin.updateUserById(client.authUserId, {
        ban_duration: '876000h',
      });
    }

    await db
      .update(clients)
      .set({ portalAccessRevoked: true, updatedAt: new Date() })
      .where(eq(clients.id, clientId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'portal.access_revoked',
      entityType: 'client',
      entityId: clientId,
      metadata: { clientName: client.fullName, revokedBy: teamUser.fullName },
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath('/clients');

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to revoke portal access' };
  }
}

/**
 * Restore portal access for a client.
 * Unbans the Supabase Auth user.
 */
/**
 * Generate a time-limited preview token for admin "View as Client" portal preview.
 * HMAC-SHA256 signed with CRON_SECRET. Expires in 15 minutes.
 */
export async function generatePortalPreviewToken(clientId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [client] = await db
      .select({ id: clients.id, fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return { error: 'CB-DB-002: Client not found' };
    }

    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return { error: 'Server configuration error: missing CRON_SECRET' };
    }

    const crypto = await import('crypto');
    const payload = {
      clientId: client.id,
      teamUserId: teamUser.id,
      exp: Date.now() + 15 * 60 * 1000, // 15 minutes
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    const token = `${payloadB64}.${sig}`;

    return { success: true, token };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'Failed to generate preview token' };
  }
}

export async function restorePortalAccess(clientId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [client] = await db
      .select({ id: clients.id, authUserId: clients.authUserId, fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return { error: 'CB-DB-002: Client not found' };
    }

    // Unban auth user if they exist
    if (client.authUserId) {
      const adminClient = createAdminClient();
      await adminClient.auth.admin.updateUserById(client.authUserId, {
        ban_duration: 'none',
      });
    }

    await db
      .update(clients)
      .set({ portalAccessRevoked: false, updatedAt: new Date() })
      .where(eq(clients.id, clientId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'portal.access_restored',
      entityType: 'client',
      entityId: clientId,
      metadata: { clientName: client.fullName, restoredBy: teamUser.fullName },
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath('/clients');

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to restore portal access' };
  }
}
