import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

export async function POST() {
  try {
    const cookieStore = await cookies();
    await requireAdmin(cookieStore);

    // Must be in demo mode to reset
    const isDemo = cookieStore.get('demo_mode')?.value === 'true';
    if (!isDemo) {
      return NextResponse.json(
        { error: 'Demo mode must be active to reset demo data.' },
        { status: 400 }
      );
    }

    // Delete in FK-safe order
    const deleteOrder = [
      'cost_entries',
      'payments',
      'invoice_line_items',
      'proposal_line_items',
      'project_milestones',
      'project_phases',
      'project_repos',
      'project_demos',
      'project_questions',
      'client_services',
      'contacts',
      'activity_log',
      'meetings',
    ];

    let totalDeleted = 0;

    for (const table of deleteOrder) {
      const result = await db.execute(
        sql.raw(`DELETE FROM ${table} WHERE is_demo = true`)
      );
      totalDeleted += result?.rowCount || 0;
    }

    // Delete invoices (after line items + payments removed)
    const invResult = await db.execute(sql.raw(`DELETE FROM invoices WHERE is_demo = true`));
    totalDeleted += invResult?.rowCount || 0;

    // Delete proposals (after line items removed)
    const propResult = await db.execute(sql.raw(`DELETE FROM proposals WHERE is_demo = true`));
    totalDeleted += propResult?.rowCount || 0;

    // Delete projects (after phases, milestones, repos, demos, questions removed)
    const projResult = await db.execute(sql.raw(`DELETE FROM projects WHERE is_demo = true`));
    totalDeleted += projResult?.rowCount || 0;

    // Delete leads (after contacts removed; check no FK refs from proposals/projects)
    const leadResult = await db.execute(sql.raw(`DELETE FROM leads WHERE is_demo = true`));
    totalDeleted += leadResult?.rowCount || 0;

    // Delete clients last (after projects, proposals, invoices removed)
    const clientResult = await db.execute(sql.raw(`DELETE FROM clients WHERE is_demo = true`));
    totalDeleted += clientResult?.rowCount || 0;

    return NextResponse.json({
      success: true,
      deleted: totalDeleted,
      message: `Deleted ${totalDeleted} demo records. Run seed-demo.mjs to re-populate.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Reset failed' },
      { status: 500 }
    );
  }
}
