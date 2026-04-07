import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db/client';
import { invoices, payments, clients, activityLog, proposals, projects, projectPhases, projectMilestones } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/client';
import { paymentReceipt } from '@/lib/email/templates';
import { paymentReceived as paymentReceivedNotif } from '@/lib/email/notifications';
import { sendTeamNotification } from '@/lib/notifications/notify';
import { DEFAULT_PROJECT_PHASES } from '@/lib/utils/constants';

/**
 * Verify Square webhook signature using HMAC-SHA256.
 */
function verifySignature(body, signatureHeader, signatureKey, notificationUrl) {
  if (!signatureKey || !signatureHeader) return false;

  try {
    const hmac = crypto.createHmac('sha256', signatureKey);
    hmac.update(notificationUrl + body);
    const expectedSignature = hmac.digest('base64');
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    const body = await request.text();
    const signature = request.headers.get('x-square-hmacsha256-signature');
    const notificationUrl =
      (process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000') +
      '/api/webhooks/square';

    // Reject if webhook signature key is not configured
    if (!signatureKey) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 503 }
      );
    }

    if (!verifySignature(body, signature, signatureKey, notificationUrl)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    const eventType = event.type;

    // Handle payment.completed event (payment on an invoice)
    if (eventType === 'payment.completed' || eventType === 'payment.updated') {
      const paymentData = event.data?.object?.payment;
      if (!paymentData) {
        return NextResponse.json({ ok: true, message: 'No payment data' });
      }

      const squarePaymentId = paymentData.id;

      // Idempotency: skip if already recorded
      const [existingPayment] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.squarePaymentId, squarePaymentId))
        .limit(1);

      if (existingPayment) {
        return NextResponse.json({ ok: true, message: 'Payment already recorded' });
      }

      // Try to find the invoice by Square invoice ID from the order
      const orderId = paymentData.orderId;
      let invoice = null;

      if (orderId) {
        // Square invoices create orders — try to match
        const [matched] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.squareInvoiceId, orderId))
          .limit(1);

        if (matched) invoice = matched;
      }

      // Also try matching by customer email if no invoice found
      if (!invoice && paymentData.buyerEmailAddress) {
        const [client] = await db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.email, paymentData.buyerEmailAddress))
          .limit(1);

        if (client) {
          // Find the most recent unpaid invoice for this client
          const [unpaid] = await db
            .select()
            .from(invoices)
            .where(eq(invoices.clientId, client.id))
            .orderBy(invoices.createdAt)
            .limit(1);

          if (unpaid && unpaid.status !== 'paid') {
            invoice = unpaid;
          }
        }
      }

      if (!invoice) {
        return NextResponse.json({ ok: true, message: 'No matching invoice' });
      }

      const amount = paymentData.amountMoney?.amount
        ? Number(paymentData.amountMoney.amount) / 100
        : Number(invoice.amount);

      const now = new Date();

      // Update invoice status to paid
      await db
        .update(invoices)
        .set({
          status: 'paid',
          paidAt: now,
          updatedAt: now,
        })
        .where(eq(invoices.id, invoice.id));

      // Insert payment record
      await db.insert(payments).values({
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        squarePaymentId,
        amount: String(amount),
        method: 'square_invoice',
        paidAt: now,
      });

      // Log to activity_log
      await db.insert(activityLog).values({
        actorType: 'system',
        action: 'payment.received',
        entityType: 'invoice',
        entityId: invoice.id,
        metadata: {
          squarePaymentId,
          amount: String(amount),
          title: invoice.title,
        },
      });

      // Send receipt to client (non-blocking)
      const [client] = await db
        .select({ email: clients.email, fullName: clients.fullName })
        .from(clients)
        .where(eq(clients.id, invoice.clientId))
        .limit(1);

      if (client?.email) {
        sendEmail({
          to: client.email,
          subject: `Payment Receipt: ${invoice.title}`,
          html: paymentReceipt(client.fullName || 'there', invoice.title, amount),
        }).catch(() => {});
      }

      // Notify team about payment (non-blocking)
      paymentReceivedNotif(invoice, { amount: String(amount) }).catch(() => {});

      // Team in-app notification (non-blocking)
      sendTeamNotification({
        type: 'payment_received',
        title: `Payment received: ${invoice.title}`,
        body: `$${amount.toFixed(2)} via Square`,
        link: `/invoices/${invoice.id}`,
      }).catch(() => {});

      // Check if this is a deposit invoice linked to a proposal → auto-create project
      if (invoice.proposalId) {
        try {
          await autoCreateProjectFromDeposit(invoice);
        } catch {
          // Non-blocking
        }
      }

      return NextResponse.json({
        ok: true,
        message: 'Payment recorded',
        invoiceId: invoice.id,
      });
    }

    // Handle invoice.payment_made event
    if (eventType === 'invoice.payment_made') {
      const invoiceData = event.data?.object?.invoice;
      if (!invoiceData) {
        return NextResponse.json({ ok: true, message: 'No invoice data' });
      }

      const squareInvoiceId = invoiceData.id;

      // Find our invoice
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.squareInvoiceId, squareInvoiceId))
        .limit(1);

      if (!invoice) {
        return NextResponse.json({ ok: true, message: 'No matching invoice' });
      }

      if (invoice.status === 'paid') {
        return NextResponse.json({ ok: true, message: 'Already paid' });
      }

      const now = new Date();
      await db
        .update(invoices)
        .set({
          status: 'paid',
          paidAt: now,
          updatedAt: now,
        })
        .where(eq(invoices.id, invoice.id));

      await db.insert(activityLog).values({
        actorType: 'system',
        action: 'payment.received',
        entityType: 'invoice',
        entityId: invoice.id,
        metadata: { squareInvoiceId, title: invoice.title },
      });

      // Send client receipt email (non-blocking)
      const [client] = await db
        .select({ email: clients.email, fullName: clients.fullName })
        .from(clients)
        .where(eq(clients.id, invoice.clientId))
        .limit(1);

      if (client?.email) {
        sendEmail({
          to: client.email,
          subject: `Payment Receipt: ${invoice.title}`,
          html: paymentReceipt(client.fullName || 'there', invoice.title, Number(invoice.amount)),
        }).catch(() => {});
      }

      // Team email notification (non-blocking)
      paymentReceivedNotif(invoice, { amount: String(invoice.amount) }).catch(() => {});

      // Team in-app notification (non-blocking)
      sendTeamNotification({
        type: 'payment_received',
        title: `Payment received: ${invoice.title}`,
        body: `$${Number(invoice.amount).toFixed(2)} via Square invoice`,
        link: `/invoices/${invoice.id}`,
      }).catch(() => {});

      // Check if this is a deposit invoice linked to a proposal → auto-create project
      if (invoice.proposalId) {
        try {
          await autoCreateProjectFromDeposit(invoice);
        } catch {
          // Non-blocking
        }
      }

      return NextResponse.json({ ok: true, message: 'Invoice marked paid' });
    }

    // Unhandled event type
    return NextResponse.json({ ok: true, message: `Unhandled event: ${eventType}` });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * Auto-create a project when a deposit invoice (linked to a proposal) is paid.
 * Only creates if no project already exists for the proposal.
 */
async function autoCreateProjectFromDeposit(invoice) {
  // Get the proposal
  const [proposal] = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      clientId: proposals.clientId,
      leadId: proposals.leadId,
      projectId: proposals.projectId,
      createdBy: proposals.createdBy,
    })
    .from(proposals)
    .where(eq(proposals.id, invoice.proposalId))
    .limit(1);

  if (!proposal) return;

  // Check if proposal already has a project linked
  if (proposal.projectId) return;

  // Check if a project was already created for this proposal
  const [existingProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.proposalId, invoice.proposalId))
    .limit(1);

  if (existingProject) return;

  // Create the project
  const [project] = await db
    .insert(projects)
    .values({
      name: proposal.title,
      clientId: proposal.clientId,
      leadId: proposal.leadId || null,
      proposalId: proposal.id,
      status: 'draft',
      createdBy: proposal.createdBy,
    })
    .returning();

  // Create default phases and milestones
  for (const phase of DEFAULT_PROJECT_PHASES) {
    const [createdPhase] = await db
      .insert(projectPhases)
      .values({
        projectId: project.id,
        name: phase.name,
        sortOrder: phase.sortOrder,
      })
      .returning();

    if (phase.milestones?.length > 0) {
      await db.insert(projectMilestones).values(
        phase.milestones.map((ms, idx) => ({
          projectId: project.id,
          phaseId: createdPhase.id,
          title: ms,
          sortOrder: idx,
        }))
      );
    }
  }

  // Link proposal to the project
  await db
    .update(proposals)
    .set({ projectId: project.id, updatedAt: new Date() })
    .where(eq(proposals.id, proposal.id));

  // Log activity
  await db.insert(activityLog).values({
    actorType: 'system',
    action: 'project.auto_created',
    entityType: 'project',
    entityId: project.id,
    metadata: {
      proposalId: proposal.id,
      invoiceId: invoice.id,
      trigger: 'deposit_payment',
    },
  });

  // Get client name for notification
  const [client] = await db
    .select({ fullName: clients.fullName })
    .from(clients)
    .where(eq(clients.id, proposal.clientId))
    .limit(1);

  // Notify team
  sendTeamNotification({
    type: 'project_created',
    title: `Project auto-created: ${proposal.title}`,
    body: `Payment received — project auto-created for ${client?.fullName || 'client'}`,
    link: `/projects/${project.id}`,
  }).catch(() => {});

  // Pipeline auto-transition → active_client
  if (proposal.leadId) {
    try {
      const { advanceLead } = await import('@/lib/pipeline/transitions');
      await advanceLead(proposal.leadId, 'active_client', 'deposit_paid');
    } catch {
      // Non-blocking
    }
  }
}
