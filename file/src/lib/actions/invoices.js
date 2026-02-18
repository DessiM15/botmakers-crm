'use server';

import { db } from '@/lib/db/client';
import { invoices, invoiceLineItems, payments, clients, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { invoiceCreateSchema } from '@/lib/utils/validators';
import { sendEmail } from '@/lib/email/client';
import { invoiceSent, paymentReceipt } from '@/lib/email/templates';
import {
  createSquareInvoice,
  createSquareCheckoutLink,
  isSquareConfigured,
} from '@/lib/integrations/square';

/**
 * Create a new invoice with line items.
 */
export async function createInvoice(formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = invoiceCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: 'CB-API-001: ' + parsed.error.issues[0].message };
    }

    const data = parsed.data;
    const lineItems = data.lineItems || [];

    // Calculate total from line items
    const total = lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0);

    const [invoice] = await db
      .insert(invoices)
      .values({
        clientId: data.clientId,
        projectId: data.projectId || null,
        milestoneId: data.milestoneId || null,
        title: data.title,
        description: data.description || null,
        amount: String(total),
        dueDate: data.dueDate || null,
        createdBy: teamUser.id,
      })
      .returning();

    if (lineItems.length > 0) {
      await db.insert(invoiceLineItems).values(
        lineItems.map((item, idx) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          total: String(item.total),
          sortOrder: item.sortOrder ?? idx,
        }))
      );
    }

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'invoice.created',
      entityType: 'invoice',
      entityId: invoice.id,
      metadata: { title: invoice.title, amount: String(total) },
    });

    revalidatePath('/invoices');
    if (data.clientId) revalidatePath(`/clients/${data.clientId}`);
    if (data.projectId) revalidatePath(`/projects/${data.projectId}`);

    return { success: true, invoice };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to create invoice' };
  }
}

/**
 * Send an invoice via Square. Creates Square invoice + sends to client email.
 */
export async function sendViaSquare(invoiceId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!isSquareConfigured()) {
      return { error: 'Square is not configured. Add SQUARE_ACCESS_TOKEN to environment variables.' };
    }

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      return { error: 'CB-DB-002: Invoice not found' };
    }

    if (invoice.status !== 'draft') {
      return { error: 'Only draft invoices can be sent via Square' };
    }

    // Get client email
    const [client] = await db
      .select({ email: clients.email, fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.id, invoice.clientId))
      .limit(1);

    if (!client?.email) {
      return { error: 'Client email not found' };
    }

    // Get line items
    const lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(invoiceLineItems.sortOrder);

    // Create Square invoice
    const squareResult = await createSquareInvoice(
      client.email,
      invoice.title,
      lineItems,
      invoice.dueDate
    );

    if (!squareResult) {
      return { error: 'CB-INT-003: Failed to create Square invoice. Check logs for details.' };
    }

    const now = new Date();
    await db
      .update(invoices)
      .set({
        squareInvoiceId: squareResult.squareInvoiceId,
        squarePaymentUrl: squareResult.squarePaymentUrl,
        status: 'sent',
        sentAt: now,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoiceId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'invoice.sent',
      entityType: 'invoice',
      entityId: invoiceId,
      metadata: {
        title: invoice.title,
        amount: invoice.amount,
        squareInvoiceId: squareResult.squareInvoiceId,
        recipientEmail: client.email,
      },
    });

    // Send notification email (non-blocking)
    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/invoices/${invoiceId}`;
    sendEmail({
      to: client.email,
      subject: `Invoice from Botmakers.ai: ${invoice.title}`,
      html: invoiceSent(
        client.fullName || 'there',
        invoice.title,
        invoice.amount,
        invoice.dueDate,
        squareResult.squarePaymentUrl || portalUrl
      ),
    }).catch(() => {});

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    if (invoice.clientId) revalidatePath(`/clients/${invoice.clientId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-INT-003: Failed to send via Square' };
  }
}

/**
 * Generate a Square payment link for an invoice.
 */
export async function generatePaymentLink(invoiceId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!isSquareConfigured()) {
      return { error: 'Square is not configured. Add SQUARE_ACCESS_TOKEN to environment variables.' };
    }

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      return { error: 'CB-DB-002: Invoice not found' };
    }

    const result = await createSquareCheckoutLink(invoice.title, invoice.amount);

    if (!result) {
      return { error: 'CB-INT-003: Failed to create payment link. Check logs for details.' };
    }

    await db
      .update(invoices)
      .set({
        squarePaymentUrl: result.paymentUrl,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'invoice.payment_link_created',
      entityType: 'invoice',
      entityId: invoiceId,
      metadata: { title: invoice.title, paymentUrl: result.paymentUrl },
    });

    revalidatePath(`/invoices/${invoiceId}`);

    return { success: true, paymentUrl: result.paymentUrl };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-INT-003: Failed to generate payment link' };
  }
}

/**
 * Mark an invoice as paid manually.
 */
export async function markPaid(invoiceId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      return { error: 'CB-DB-002: Invoice not found' };
    }

    if (invoice.status === 'paid') {
      return { error: 'Invoice is already paid' };
    }

    const now = new Date();
    await db
      .update(invoices)
      .set({
        status: 'paid',
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoiceId));

    // Insert manual payment record
    await db.insert(payments).values({
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      amount: invoice.amount,
      method: 'manual',
      paidAt: now,
    });

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'payment.received',
      entityType: 'invoice',
      entityId: invoiceId,
      metadata: {
        title: invoice.title,
        amount: invoice.amount,
        method: 'manual',
      },
    });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    if (invoice.clientId) revalidatePath(`/clients/${invoice.clientId}`);
    if (invoice.projectId) revalidatePath(`/projects/${invoice.projectId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to mark invoice as paid' };
  }
}

/**
 * Send a payment reminder email for a sent/overdue invoice.
 */
export async function sendReminder(invoiceId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      return { error: 'CB-DB-002: Invoice not found' };
    }

    if (!['sent', 'viewed', 'overdue'].includes(invoice.status)) {
      return { error: 'Can only send reminders for sent or overdue invoices' };
    }

    const [client] = await db
      .select({ email: clients.email, fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.id, invoice.clientId))
      .limit(1);

    if (!client?.email) {
      return { error: 'Client email not found' };
    }

    const paymentUrl = invoice.squarePaymentUrl ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/invoices/${invoiceId}`;

    await sendEmail({
      to: client.email,
      subject: `Payment Reminder: ${invoice.title}`,
      html: invoiceSent(
        client.fullName || 'there',
        invoice.title,
        invoice.amount,
        invoice.dueDate,
        paymentUrl
      ),
    });

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'invoice.reminder_sent',
      entityType: 'invoice',
      entityId: invoiceId,
      metadata: { title: invoice.title, recipientEmail: client.email },
    });

    revalidatePath(`/invoices/${invoiceId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-INT-001: Failed to send reminder' };
  }
}

/**
 * Create an invoice from a completed milestone (called from updateMilestone).
 * This is NOT a server action (no 'use server' needed since it's in the same module context).
 */
export async function createInvoiceFromMilestone(milestone, project, teamUserId) {
  try {
    const total = milestone.invoiceAmount ? String(milestone.invoiceAmount) : '0';

    const [invoice] = await db
      .insert(invoices)
      .values({
        clientId: project.clientId,
        projectId: project.id,
        milestoneId: milestone.id,
        title: `${project.name} — ${milestone.title}`,
        description: `Auto-generated invoice for milestone: ${milestone.title}`,
        amount: total,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdBy: teamUserId,
      })
      .returning();

    // Add a single line item matching the milestone
    await db.insert(invoiceLineItems).values({
      invoiceId: invoice.id,
      description: milestone.title,
      quantity: '1',
      unitPrice: total,
      total: total,
      sortOrder: 0,
    });

    await db.insert(activityLog).values({
      actorId: teamUserId,
      actorType: 'team',
      action: 'invoice.auto_created',
      entityType: 'invoice',
      entityId: invoice.id,
      metadata: {
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        projectId: project.id,
        amount: total,
      },
    });

    // Try to send via Square if configured
    if (isSquareConfigured()) {
      const [client] = await db
        .select({ email: clients.email, fullName: clients.fullName })
        .from(clients)
        .where(eq(clients.id, project.clientId))
        .limit(1);

      if (client?.email) {
        const squareResult = await createSquareInvoice(
          client.email,
          invoice.title,
          [{ description: milestone.title, quantity: 1, unitPrice: total }],
          invoice.dueDate
        );

        if (squareResult) {
          await db
            .update(invoices)
            .set({
              squareInvoiceId: squareResult.squareInvoiceId,
              squarePaymentUrl: squareResult.squarePaymentUrl,
              status: 'sent',
              sentAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, invoice.id));
        }
      }
    }

    revalidatePath('/invoices');
    revalidatePath(`/projects/${project.id}`);
    if (project.clientId) revalidatePath(`/clients/${project.clientId}`);

    return { success: true, invoice };
  } catch (error) {
    return { error: 'Failed to auto-create invoice' };
  }
}
