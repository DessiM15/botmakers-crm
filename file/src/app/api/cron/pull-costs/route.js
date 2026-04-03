import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { costEntries, activityLog, clientServices } from '@/lib/db/schema';
import { sql, and, eq, or } from 'drizzle-orm';

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

    // Calculate previous month date range
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const startDate = prevMonth.toISOString().split('T')[0];
    const endDate = prevMonthEnd.toISOString().split('T')[0];

    const results = { vercel: null, anthropic: null, squareFees: null, serviceCosts: null };

    // Pull Vercel costs
    try {
      const { isVercelBillingConfigured, getVercelCharges } = await import('@/lib/integrations/vercel-billing');
      if (isVercelBillingConfigured()) {
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
              })
              .onConflictDoNothing();
            inserted++;
          } catch {
            // Duplicate
          }
        }
        results.vercel = { pulled: charges.length, inserted };
      }
    } catch {
      results.vercel = { error: 'Failed to pull Vercel costs' };
    }

    // Pull Anthropic costs
    try {
      const { isAnthropicBillingConfigured, getAnthropicCostReport } = await import('@/lib/integrations/anthropic-billing');
      if (isAnthropicBillingConfigured()) {
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
              })
              .onConflictDoNothing();
            inserted++;
          } catch {
            // Duplicate
          }
        }
        results.anthropic = { pulled: costs.length, inserted };
      }
    } catch {
      results.anthropic = { error: 'Failed to pull Anthropic costs' };
    }

    // Calculate Square fees
    try {
      const { calculateSquareFees } = await import('@/lib/integrations/square');
      const paymentResult = await db.execute(sql`
        SELECT id, amount, method, paid_at, client_id
        FROM payments
        WHERE paid_at >= ${startDate}::timestamptz
          AND paid_at < (${endDate}::date + INTERVAL '1 day')::timestamptz
          AND method IN ('square_invoice', 'square_checkout')
      `);

      const paymentRows = paymentResult.rows || [];
      let totalFees = 0;

      for (const p of paymentRows) {
        const amount = Number(p.amount) || 0;
        const isOnline = p.method === 'square_checkout';
        totalFees += calculateSquareFees(amount, isOnline);
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
              metadata: { paymentCount: paymentRows.length, totalFees },
            })
            .onConflictDoNothing();
        } catch {
          // Duplicate
        }
      }

      results.squareFees = { payments: paymentRows.length, totalFees: Math.round(totalFees * 100) / 100 };
    } catch {
      results.squareFees = { error: 'Failed to calculate Square fees' };
    }

    // Generate cost entries from tracked 3rd party services
    try {
      const providerSourceMap = {
        supabase: 'supabase',
        github: 'github',
        resend: 'resend',
        upstash: 'upstash',
        vercel: 'vercel',
      };

      const activeServices = await db
        .select({
          id: clientServices.id,
          clientId: clientServices.clientId,
          projectId: clientServices.projectId,
          serviceName: clientServices.serviceName,
          provider: clientServices.provider,
          monthlyCost: clientServices.monthlyCost,
        })
        .from(clientServices)
        .where(
          and(
            sql`${clientServices.status} IN ('active', 'expiring_soon')`,
            sql`${clientServices.monthlyCost}::numeric > 0`
          )
        );

      let inserted = 0;
      const periodYM = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

      for (const svc of activeServices) {
        const providerLower = (svc.provider || '').toLowerCase();
        const source = providerSourceMap[providerLower] || 'other';
        const externalId = `svc-${svc.id}-${periodYM}`;

        try {
          await db
            .insert(costEntries)
            .values({
              serviceId: svc.id,
              clientId: svc.clientId,
              projectId: svc.projectId,
              source,
              provider: svc.provider,
              description: `${svc.serviceName} — monthly service cost`,
              amount: String(svc.monthlyCost),
              periodStart: startDate,
              periodEnd: endDate,
              externalId,
            })
            .onConflictDoNothing();
          inserted++;
        } catch {
          // Duplicate
        }
      }

      results.serviceCosts = { found: activeServices.length, inserted };
    } catch {
      results.serviceCosts = { error: 'Failed to generate service cost entries' };
    }

    // Log activity
    await db.insert(activityLog).values({
      actorType: 'system',
      action: 'cost.cron_pull',
      entityType: 'cost_entry',
      entityId: '00000000-0000-0000-0000-000000000000',
      metadata: { period: `${startDate} to ${endDate}`, results },
    });

    return NextResponse.json({
      ok: true,
      period: { startDate, endDate },
      results,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
