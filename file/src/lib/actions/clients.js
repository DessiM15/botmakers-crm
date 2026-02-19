'use server';

import { db } from '@/lib/db/client';
import { createAdminClient } from '@/lib/db/client';
import { clients, leads, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { clientCreateSchema, clientUpdateSchema } from '@/lib/utils/validators';
import { sendEmail } from '@/lib/email/client';
import { welcomeClient } from '@/lib/email/templates';

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
