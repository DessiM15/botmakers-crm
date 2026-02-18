'use server';

import { db } from '@/lib/db/client';
import { invoices, payments, clients, activityLog } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  getSquareInvoices,
  getSquarePayments,
  isSquareConfigured,
} from '@/lib/integrations/square';

/**
 * Backfill Square history into CRM database.
 * Fetches invoices and payments from Square, matches to clients, inserts if not exists.
 */
export async function backfillSquareHistory() {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireAdmin(cookieStore);

    if (!isSquareConfigured()) {
      return { error: 'Square is not configured' };
    }

    let invoicesImported = 0;
    let paymentsImported = 0;
    const errors = [];

    // Fetch Square invoices
    const squareInvoices = await getSquareInvoices(100);

    for (const sqInvoice of squareInvoices) {
      try {
        // Check if already imported
        const [existing] = await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(eq(invoices.squareInvoiceId, sqInvoice.id))
          .limit(1);

        if (existing) continue;

        // Try to find client by customer email
        const customerEmail = sqInvoice.primaryRecipient?.emailAddress;
        let clientId = null;

        if (customerEmail) {
          const [client] = await db
            .select({ id: clients.id })
            .from(clients)
            .where(eq(clients.email, customerEmail))
            .limit(1);

          if (client) {
            clientId = client.id;
          }
        }

        if (!clientId) {
          errors.push(`Skipped invoice ${sqInvoice.id}: no matching client for ${customerEmail || 'unknown email'}`);
          continue;
        }

        // Calculate amount from payment requests
        const amount = sqInvoice.paymentRequests?.[0]?.computedAmountMoney?.amount
          ? Number(sqInvoice.paymentRequests[0].computedAmountMoney.amount) / 100
          : 0;

        // Map Square status to our status
        let status = 'draft';
        if (sqInvoice.status === 'PAID') status = 'paid';
        else if (sqInvoice.status === 'SENT' || sqInvoice.status === 'UNPAID') status = 'sent';
        else if (sqInvoice.status === 'CANCELED') status = 'cancelled';

        await db.insert(invoices).values({
          clientId,
          squareInvoiceId: sqInvoice.id,
          squarePaymentUrl: sqInvoice.publicUrl || null,
          title: sqInvoice.title || `Square Invoice #${sqInvoice.invoiceNumber || sqInvoice.id.slice(0, 8)}`,
          description: sqInvoice.description || null,
          amount: String(amount),
          status,
          sentAt: sqInvoice.publicUrl ? new Date(sqInvoice.createdAt) : null,
          paidAt: status === 'paid' && sqInvoice.updatedAt ? new Date(sqInvoice.updatedAt) : null,
          dueDate: sqInvoice.paymentRequests?.[0]?.dueDate || null,
          createdBy: teamUser.id,
        });

        invoicesImported++;
      } catch (err) {
        errors.push(`Error importing invoice ${sqInvoice.id}: ${err.message}`);
      }
    }

    // Fetch Square payments
    const squarePayments = await getSquarePayments(100);

    for (const sqPayment of squarePayments) {
      try {
        // Check if already recorded
        const [existing] = await db
          .select({ id: payments.id })
          .from(payments)
          .where(eq(payments.squarePaymentId, sqPayment.id))
          .limit(1);

        if (existing) continue;

        // Try to match to an invoice via order_id or receipt
        let invoiceId = null;
        let clientId = null;

        if (sqPayment.orderId) {
          // Find invoice by Square invoice that references this order
          const [inv] = await db
            .select({ id: invoices.id, clientId: invoices.clientId })
            .from(invoices)
            .where(sql`${invoices.squareInvoiceId} IS NOT NULL`)
            .limit(1);

          if (inv) {
            invoiceId = inv.id;
            clientId = inv.clientId;
          }
        }

        if (!invoiceId || !clientId) {
          // Try matching by buyer email
          const buyerEmail = sqPayment.buyerEmailAddress;
          if (buyerEmail) {
            const [client] = await db
              .select({ id: clients.id })
              .from(clients)
              .where(eq(clients.email, buyerEmail))
              .limit(1);

            if (client) clientId = client.id;
          }
        }

        if (!clientId) continue;

        const amount = sqPayment.amountMoney?.amount
          ? Number(sqPayment.amountMoney.amount) / 100
          : 0;

        // Determine payment method
        let method = 'square_checkout';
        if (sqPayment.sourceType === 'CARD') method = 'square_checkout';

        if (invoiceId) {
          await db.insert(payments).values({
            invoiceId,
            clientId,
            squarePaymentId: sqPayment.id,
            amount: String(amount),
            method,
            paidAt: sqPayment.createdAt ? new Date(sqPayment.createdAt) : new Date(),
          });
          paymentsImported++;
        }
      } catch (err) {
        errors.push(`Error importing payment ${sqPayment.id}: ${err.message}`);
      }
    }

    // Log the backfill
    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'square.backfill',
      entityType: 'system',
      entityId: teamUser.id,
      metadata: { invoicesImported, paymentsImported, errorCount: errors.length },
    });

    revalidatePath('/invoices');
    revalidatePath('/settings');

    return {
      success: true,
      invoicesImported,
      paymentsImported,
      errors,
    };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-INT-003: Failed to backfill Square history' };
  }
}
