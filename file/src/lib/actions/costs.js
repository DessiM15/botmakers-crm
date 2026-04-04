'use server';

import { db } from '@/lib/db/client';
import { costEntries, activityLog } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import { costEntryCreateSchema, costEntryUpdateSchema } from '@/lib/utils/validators';
import { isDemoMode } from '@/lib/utils/demo';

/**
 * Create a manual cost entry.
 */
export async function createCostEntry(formData) {
  try {
    const cookieStore = await cookies();
    const user = await requireTeam(cookieStore);
    const isDemo = await isDemoMode();

    const parsed = costEntryCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || 'Invalid data (CB-API-001)' };
    }

    const data = parsed.data;

    const [entry] = await db
      .insert(costEntries)
      .values({
        clientId: data.clientId || null,
        projectId: data.projectId || null,
        serviceId: data.serviceId || null,
        source: data.source || 'manual',
        provider: data.provider,
        description: data.description,
        amount: String(data.amount),
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        externalId: data.externalId || null,
        metadata: data.metadata || null,
        createdBy: user.id,
        isDemo,
      })
      .returning({ id: costEntries.id });

    await db.insert(activityLog).values({
      actorId: user.id,
      actorType: 'team',
      action: 'cost.created',
      entityType: 'cost_entry',
      entityId: entry.id,
      metadata: { provider: data.provider, amount: data.amount },
      isDemo,
    });

    revalidatePath('/costs');
    if (data.projectId) revalidatePath(`/projects/${data.projectId}`);
    if (data.clientId) revalidatePath(`/clients/${data.clientId}`);

    return { success: true, id: entry.id };
  } catch (error) {
    return { error: 'Failed to create cost entry (CB-DB-001)' };
  }
}

/**
 * Update a manual cost entry.
 */
export async function updateCostEntry(id, formData) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    // Only allow editing manual entries
    const [existing] = await db
      .select({ source: costEntries.source })
      .from(costEntries)
      .where(eq(costEntries.id, id))
      .limit(1);

    if (!existing) {
      return { error: 'Cost entry not found (CB-DB-002)' };
    }
    if (existing.source !== 'manual') {
      return { error: 'Only manual entries can be edited' };
    }

    const parsed = costEntryUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message || 'Invalid data (CB-API-001)' };
    }

    const updates = {};
    const data = parsed.data;
    if (data.clientId !== undefined) updates.clientId = data.clientId || null;
    if (data.projectId !== undefined) updates.projectId = data.projectId || null;
    if (data.serviceId !== undefined) updates.serviceId = data.serviceId || null;
    if (data.provider) updates.provider = data.provider;
    if (data.description) updates.description = data.description;
    if (data.amount !== undefined) updates.amount = String(data.amount);
    if (data.periodStart) updates.periodStart = data.periodStart;
    if (data.periodEnd) updates.periodEnd = data.periodEnd;
    updates.updatedAt = new Date();

    await db.update(costEntries).set(updates).where(eq(costEntries.id, id));

    revalidatePath('/costs');
    return { success: true };
  } catch (error) {
    return { error: 'Failed to update cost entry (CB-DB-001)' };
  }
}

/**
 * Delete a manual cost entry.
 */
export async function deleteCostEntry(id) {
  try {
    const cookieStore = await cookies();
    const user = await requireTeam(cookieStore);
    const isDemo = await isDemoMode();

    const [existing] = await db
      .select({ source: costEntries.source, provider: costEntries.provider })
      .from(costEntries)
      .where(eq(costEntries.id, id))
      .limit(1);

    if (!existing) {
      return { error: 'Cost entry not found (CB-DB-002)' };
    }
    if (existing.source !== 'manual') {
      return { error: 'Only manual entries can be deleted' };
    }

    await db.delete(costEntries).where(eq(costEntries.id, id));

    await db.insert(activityLog).values({
      actorId: user.id,
      actorType: 'team',
      action: 'cost.deleted',
      entityType: 'cost_entry',
      entityId: id,
      metadata: { provider: existing.provider },
      isDemo,
    });

    revalidatePath('/costs');
    return { success: true };
  } catch (error) {
    return { error: 'Failed to delete cost entry (CB-DB-001)' };
  }
}

/**
 * Allocate a cost to a project.
 */
export async function allocateCostToProject(costEntryId, projectId) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    await db
      .update(costEntries)
      .set({ projectId, updatedAt: new Date() })
      .where(eq(costEntries.id, costEntryId));

    revalidatePath('/costs');
    if (projectId) revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    return { error: 'Failed to allocate cost (CB-DB-001)' };
  }
}

/**
 * Allocate a cost to a client.
 */
export async function allocateCostToClient(costEntryId, clientId) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    await db
      .update(costEntries)
      .set({ clientId, updatedAt: new Date() })
      .where(eq(costEntries.id, costEntryId));

    revalidatePath('/costs');
    if (clientId) revalidatePath(`/clients/${clientId}`);
    return { success: true };
  } catch (error) {
    return { error: 'Failed to allocate cost (CB-DB-001)' };
  }
}

/**
 * Pull Vercel costs for a date range.
 */
export async function pullVercelCosts(startDate, endDate) {
  try {
    const cookieStore = await cookies();
    const user = await requireTeam(cookieStore);
    const isDemo = await isDemoMode();

    const { isVercelBillingConfigured, getVercelCharges } = await import('@/lib/integrations/vercel-billing');
    if (!isVercelBillingConfigured()) {
      return { error: 'Vercel billing not configured — set VERCEL_API_TOKEN' };
    }

    const charges = await getVercelCharges(startDate, endDate);
    let inserted = 0;

    for (const charge of charges) {
      try {
        await db
          .insert(costEntries)
          .values({
            source: 'vercel',
            provider: 'Vercel',
            description: charge.description || `Vercel — ${charge.name || 'Usage'}`,
            amount: String(charge.amount),
            periodStart: startDate,
            periodEnd: endDate,
            externalId: charge.id || `vercel-${startDate}-${charge.name}`,
            metadata: charge,
            createdBy: user.id,
            isDemo,
          })
          .onConflictDoNothing();
        inserted++;
      } catch {
        // Duplicate — skip
      }
    }

    await db.insert(activityLog).values({
      actorId: user.id,
      actorType: 'team',
      action: 'cost.vercel_pulled',
      entityType: 'cost_entry',
      entityId: user.id,
      metadata: { startDate, endDate, inserted },
      isDemo,
    });

    revalidatePath('/costs');
    return { success: true, inserted };
  } catch (error) {
    return { error: 'Failed to pull Vercel costs (CB-INT-004)' };
  }
}

/**
 * Pull Anthropic costs for a date range.
 */
export async function pullAnthropicCosts(startDate, endDate) {
  try {
    const cookieStore = await cookies();
    const user = await requireTeam(cookieStore);
    const isDemo = await isDemoMode();

    const { isAnthropicBillingConfigured, getAnthropicCostReport } = await import('@/lib/integrations/anthropic-billing');
    if (!isAnthropicBillingConfigured()) {
      return { error: 'Anthropic billing not configured — set ANTHROPIC_ADMIN_API_KEY' };
    }

    const costs = await getAnthropicCostReport(startDate, endDate);
    let inserted = 0;

    for (const cost of costs) {
      try {
        await db
          .insert(costEntries)
          .values({
            source: 'anthropic',
            provider: 'Anthropic',
            description: cost.description || `Anthropic API — ${cost.model || 'Usage'}`,
            amount: String(cost.amount),
            periodStart: startDate,
            periodEnd: endDate,
            externalId: cost.id || `anthropic-${startDate}-${cost.model || 'total'}`,
            metadata: cost,
            createdBy: user.id,
            isDemo,
          })
          .onConflictDoNothing();
        inserted++;
      } catch {
        // Duplicate — skip
      }
    }

    await db.insert(activityLog).values({
      actorId: user.id,
      actorType: 'team',
      action: 'cost.anthropic_pulled',
      entityType: 'cost_entry',
      entityId: user.id,
      metadata: { startDate, endDate, inserted },
      isDemo,
    });

    revalidatePath('/costs');
    return { success: true, inserted };
  } catch (error) {
    return { error: 'Failed to pull Anthropic costs (CB-INT-002)' };
  }
}

/**
 * Calculate Square processing fees from payments in a date range.
 */
export async function calculateSquareFeesForPeriod(startDate, endDate) {
  try {
    const cookieStore = await cookies();
    const user = await requireTeam(cookieStore);
    const isDemo = await isDemoMode();

    const { calculateSquareFees } = await import('@/lib/integrations/square');

    // Get payments in the period
    const result = await db.execute(sql`
      SELECT id, amount, method, paid_at, client_id, invoice_id
      FROM payments
      WHERE paid_at >= ${startDate}::timestamptz
        AND paid_at <= ${endDate}::timestamptz
        AND method IN ('square_invoice', 'square_checkout')
    `);

    const paymentRows = result.rows || [];
    let totalFees = 0;
    const feeDetails = [];

    for (const p of paymentRows) {
      const amount = Number(p.amount) || 0;
      const isOnline = p.method === 'square_checkout';
      const fee = calculateSquareFees(amount, isOnline);
      totalFees += fee;
      feeDetails.push({ paymentId: p.id, amount, fee, method: p.method });
    }

    if (totalFees > 0) {
      const externalId = `square-fees-${startDate}-${endDate}`;
      try {
        await db
          .insert(costEntries)
          .values({
            source: 'square_fees',
            provider: 'Square',
            description: `Square processing fees — ${startDate} to ${endDate}`,
            amount: String(Math.round(totalFees * 100) / 100),
            periodStart: startDate,
            periodEnd: endDate,
            externalId,
            metadata: { paymentCount: paymentRows.length, feeDetails },
            createdBy: user.id,
            isDemo,
          })
          .onConflictDoNothing();
      } catch {
        // Duplicate
      }
    }

    await db.insert(activityLog).values({
      actorId: user.id,
      actorType: 'team',
      action: 'cost.square_fees_calculated',
      entityType: 'cost_entry',
      entityId: user.id,
      metadata: { startDate, endDate, totalFees, paymentCount: paymentRows.length },
      isDemo,
    });

    revalidatePath('/costs');
    return { success: true, totalFees: Math.round(totalFees * 100) / 100, paymentCount: paymentRows.length };
  } catch (error) {
    return { error: 'Failed to calculate Square fees (CB-INT-003)' };
  }
}
