'use server';

import { db } from '@/lib/db/client';
import { clientServices, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { serviceCreateSchema, serviceUpdateSchema } from '@/lib/utils/validators';

/**
 * Create a new client or internal service.
 */
export async function createService(formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = serviceCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: `CB-API-001: ${parsed.error.issues[0]?.message || 'Validation failed'}` };
    }

    const data = parsed.data;
    const isInternal = !data.clientId;

    const [service] = await db
      .insert(clientServices)
      .values({
        clientId: data.clientId || null,
        projectId: data.projectId || null,
        serviceName: data.serviceName,
        provider: data.provider,
        category: data.category,
        monthlyCost: String(data.monthlyCost),
        billingCycle: data.billingCycle,
        renewalDate: data.renewalDate || null,
        status: data.status,
        loginUrl: data.loginUrl || null,
        credentialsVaultUrl: data.credentialsVaultUrl || null,
        accountIdentifier: data.accountIdentifier || null,
        notes: data.notes || null,
      })
      .returning();

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'service.created',
      entityType: isInternal ? 'service' : 'client',
      entityId: isInternal ? service.id : data.clientId,
      metadata: { serviceId: service.id, serviceName: data.serviceName, provider: data.provider, internal: isInternal },
    });

    revalidatePath('/services');
    if (data.clientId) revalidatePath(`/clients/${data.clientId}`);
    if (data.projectId) revalidatePath(`/projects/${data.projectId}`);

    return { success: true, service };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to create service' };
  }
}

/**
 * Update an existing service.
 */
export async function updateService(id, formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = serviceUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: `CB-API-001: ${parsed.error.issues[0]?.message || 'Validation failed'}` };
    }

    const data = parsed.data;

    // Build update object with only defined fields
    const updateData = { updatedAt: new Date() };
    if (data.clientId !== undefined) updateData.clientId = data.clientId || null;
    if (data.serviceName !== undefined) updateData.serviceName = data.serviceName;
    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.monthlyCost !== undefined) updateData.monthlyCost = String(data.monthlyCost);
    if (data.billingCycle !== undefined) updateData.billingCycle = data.billingCycle;
    if (data.renewalDate !== undefined) updateData.renewalDate = data.renewalDate || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.loginUrl !== undefined) updateData.loginUrl = data.loginUrl || null;
    if (data.credentialsVaultUrl !== undefined) updateData.credentialsVaultUrl = data.credentialsVaultUrl || null;
    if (data.accountIdentifier !== undefined) updateData.accountIdentifier = data.accountIdentifier || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.projectId !== undefined) updateData.projectId = data.projectId || null;

    const [updated] = await db
      .update(clientServices)
      .set(updateData)
      .where(eq(clientServices.id, id))
      .returning();

    if (!updated) {
      return { error: 'CB-DB-002: Service not found' };
    }

    const isInternal = !updated.clientId;

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'service.updated',
      entityType: isInternal ? 'service' : 'client',
      entityId: isInternal ? id : updated.clientId,
      metadata: { serviceId: id, serviceName: updated.serviceName, internal: isInternal },
    });

    revalidatePath('/services');
    if (updated.clientId) revalidatePath(`/clients/${updated.clientId}`);
    if (updated.projectId) revalidatePath(`/projects/${updated.projectId}`);

    return { success: true, service: updated };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to update service' };
  }
}

/**
 * Delete a service.
 */
export async function deleteService(id) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [service] = await db
      .select({ id: clientServices.id, clientId: clientServices.clientId, serviceName: clientServices.serviceName, projectId: clientServices.projectId })
      .from(clientServices)
      .where(eq(clientServices.id, id))
      .limit(1);

    if (!service) {
      return { error: 'CB-DB-002: Service not found' };
    }

    await db.delete(clientServices).where(eq(clientServices.id, id));

    const isInternal = !service.clientId;

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'service.deleted',
      entityType: isInternal ? 'service' : 'client',
      entityId: isInternal ? id : service.clientId,
      metadata: { serviceId: id, serviceName: service.serviceName, internal: isInternal },
    });

    revalidatePath('/services');
    if (service.clientId) revalidatePath(`/clients/${service.clientId}`);
    if (service.projectId) revalidatePath(`/projects/${service.projectId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to delete service' };
  }
}
