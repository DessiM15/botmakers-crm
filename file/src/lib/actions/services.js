'use server';

import { db } from '@/lib/db/client';
import { clientServices, activityLog, projectRepos, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { serviceCreateSchema, serviceUpdateSchema } from '@/lib/utils/validators';
import { scanRepoForServices } from '@/lib/integrations/repo-scanner';
import { SERVICE_DETECTION_RULES, DEFAULT_SERVICE_PRICING } from '@/lib/utils/constants';

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

/**
 * Scan a project's linked repos for 3rd-party services.
 * Returns { detected, existing, new, scannedFiles, scanTime }
 */
export async function scanProjectServices(projectId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const repos = await db
      .select()
      .from(projectRepos)
      .where(eq(projectRepos.projectId, projectId));

    if (repos.length === 0) {
      return { error: 'No GitHub repos linked. Link a repo first, then scan.' };
    }

    const allDetected = [];
    const allScannedFiles = [];

    for (const repo of repos) {
      const result = await scanRepoForServices(
        repo.githubOwner,
        repo.githubRepo,
        repo.defaultBranch
      );
      for (const svc of result.detectedServices) {
        const existing = allDetected.find((d) => d.provider === svc.provider);
        if (existing) {
          const order = { high: 0, medium: 1, low: 2 };
          if (order[svc.confidence] < order[existing.confidence]) {
            existing.confidence = svc.confidence;
          }
          for (const sig of svc.signals) {
            if (!existing.signals.includes(sig)) {
              existing.signals.push(repos.length > 1 ? `${sig} (${repo.githubOwner}/${repo.githubRepo})` : sig);
            }
          }
        } else {
          allDetected.push({
            ...svc,
            signals: svc.signals.map((s) =>
              repos.length > 1 ? `${s} (${repo.githubOwner}/${repo.githubRepo})` : s
            ),
          });
        }
      }
      allScannedFiles.push(
        ...result.scannedFiles.map((f) =>
          repos.length > 1 ? `${repo.githubOwner}/${repo.githubRepo}/${f}` : f
        )
      );
    }

    const trackedServices = await db
      .select()
      .from(clientServices)
      .where(eq(clientServices.projectId, projectId));

    const trackedProviders = trackedServices.map((s) => s.provider.toLowerCase());

    const detected = allDetected.map((d) => ({
      ...d,
      alreadyTracked: trackedProviders.includes(d.provider.toLowerCase()),
    }));

    const newServices = detected.filter((d) => !d.alreadyTracked);
    const existingServices = detected.filter((d) => d.alreadyTracked);

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'service.scan',
      entityType: 'project',
      entityId: projectId,
      metadata: {
        reposScanned: repos.length,
        filesScanned: allScannedFiles.length,
        servicesFound: allDetected.length,
        newServices: newServices.length,
      },
    });

    revalidatePath(`/projects/${projectId}`);

    return {
      detected,
      existing: existingServices,
      new: newServices,
      scannedFiles: allScannedFiles,
      scanTime: new Date().toISOString(),
    };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-INT-004: Failed to scan repositories' };
  }
}

/**
 * Confirm detected services — create client_services rows for selected providers.
 */
export async function confirmDetectedServices(projectId, selectedProviders) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!selectedProviders?.length) {
      return { error: 'CB-API-001: Select at least one service to add' };
    }

    const [project] = await db
      .select({ clientId: projects.clientId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return { error: 'CB-DB-002: Project not found' };
    }

    const existing = await db
      .select({ provider: clientServices.provider })
      .from(clientServices)
      .where(eq(clientServices.projectId, projectId));

    const existingProviders = existing.map((e) => e.provider.toLowerCase());
    let created = 0;

    for (const provider of selectedProviders) {
      if (existingProviders.includes(provider.toLowerCase())) continue;

      const rule = SERVICE_DETECTION_RULES.find(
        (r) => r.provider.toLowerCase() === provider.toLowerCase()
      );

      const pricing = DEFAULT_SERVICE_PRICING[provider];
      const monthlyCost = pricing ? String(pricing.monthlyCost) : '0';
      const planLabel = pricing ? pricing.plan : null;
      const serviceName = planLabel ? `${provider} ${planLabel}` : `${provider} (auto-detected)`;
      const notes = pricing
        ? `Auto-detected · Default pricing $${pricing.monthlyCost}/mo`
        : 'Auto-detected from GitHub repo scan';

      const [newService] = await db
        .insert(clientServices)
        .values({
          clientId: project.clientId,
          projectId,
          serviceName,
          provider,
          category: rule?.category || 'other',
          status: 'active',
          monthlyCost,
          notes,
        })
        .returning();

      await db.insert(activityLog).values({
        actorId: teamUser.id,
        actorType: 'team',
        action: 'service.auto_created',
        entityType: 'project',
        entityId: projectId,
        metadata: { serviceId: newService.id, provider },
      });

      created++;
    }

    revalidatePath(`/projects/${projectId}`);

    return { success: true, created };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to add services' };
  }
}

/**
 * Add a service manually to a project.
 */
export async function addManualProjectService(projectId, data) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!data.serviceName?.trim() || !data.provider?.trim()) {
      return { error: 'CB-API-001: Service name and provider are required' };
    }

    const [project] = await db
      .select({ clientId: projects.clientId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return { error: 'CB-DB-002: Project not found' };
    }

    const [newService] = await db
      .insert(clientServices)
      .values({
        clientId: project.clientId,
        projectId,
        serviceName: data.serviceName.trim(),
        provider: data.provider.trim(),
        category: data.category || 'other',
        status: 'active',
        monthlyCost: data.monthlyCost || '0',
        loginUrl: data.loginUrl?.trim() || null,
        accountIdentifier: data.accountIdentifier?.trim() || null,
        notes: data.notes?.trim() || null,
      })
      .returning();

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'service.manual_created',
      entityType: 'project',
      entityId: projectId,
      metadata: { serviceId: newService.id, provider: data.provider },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true, service: newService };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to add service' };
  }
}

/**
 * Remove a service from a project.
 */
export async function removeProjectService(serviceId, projectId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [service] = await db
      .select()
      .from(clientServices)
      .where(and(eq(clientServices.id, serviceId), eq(clientServices.projectId, projectId)))
      .limit(1);

    if (!service) {
      return { error: 'CB-DB-002: Service not found' };
    }

    await db.delete(clientServices).where(eq(clientServices.id, serviceId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'service.removed',
      entityType: 'project',
      entityId: projectId,
      metadata: { provider: service.provider, serviceName: service.serviceName },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to remove service' };
  }
}
