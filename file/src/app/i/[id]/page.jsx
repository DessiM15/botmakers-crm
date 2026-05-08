import { notFound } from 'next/navigation';
import crypto from 'crypto';
import { db } from '@/lib/db/client';
import { invoices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getPublicInvoice } from '@/lib/db/queries/portal';
import PortalLayout from '@/components/crm/PortalLayout';
import InvoicePrintButton from '@/components/crm/InvoicePrintButton';

export const metadata = {
  title: 'Invoice — BotMakers',
  robots: { index: false, follow: false },
};

export default async function PublicInvoicePage({ params, searchParams }) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token || !id) notFound();

  // Verify HMAC token
  const secret = process.env.CRON_SECRET || 'fallback-secret';
  const expectedToken = crypto
    .createHmac('sha256', secret)
    .update(`invoice:${id}`)
    .digest('hex');

  const tokenBuf = Buffer.from(token, 'hex');
  const expectedBuf = Buffer.from(expectedToken, 'hex');

  if (
    tokenBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(tokenBuf, expectedBuf)
  ) {
    notFound();
  }

  let invoice;
  try {
    invoice = await getPublicInvoice(id);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[PublicInvoice] Data fetch error:', err.message);
  }

  if (!invoice) notFound();

  // Track view: update viewedAt and status to 'viewed' if currently 'sent'
  try {
    const updates = {};
    if (!invoice.viewedAt) {
      updates.viewedAt = new Date();
    }
    if (invoice.status === 'sent') {
      updates.status = 'viewed';
    }
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db.update(invoices).set(updates).where(eq(invoices.id, id));
    }
  } catch {
    // Non-critical — don't block rendering
  }

  const formatCurrency = (val) =>
    Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;

  const isPaid = invoice.status === 'paid';
  const lineItems = invoice.lineItems || [];

  return (
    <PortalLayout isPublic>
      {/* Print-only branded header — hidden on screen, shown when printing */}
      <div className='invoice-print-header'>
        <div className='d-flex align-items-center justify-content-between mb-3'>
          <div>
            <img
              src='/assets/images/botmakers-logo.png'
              alt='BotMakers'
              style={{ height: 32 }}
            />
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: '12px' }}>
              botmakers.ai &bull; team@botmakers.ai &bull; 832.790.5001
            </p>
          </div>
          <div className='text-end'>
            <span style={{ fontSize: '24px', fontWeight: 700, color: '#033457', letterSpacing: '2px' }}>
              INVOICE
            </span>
          </div>
        </div>
        <hr style={{ border: 'none', borderTop: '2px solid #033457', margin: '0 0 16px' }} />
      </div>

      {/* Print Invoice button */}
      <div className='d-flex justify-content-end mb-3 invoice-no-print'>
        <InvoicePrintButton />
      </div>

      {/* Invoice Header */}
      <div className='card border-0 shadow-sm mb-4'>
        <div className='card-body'>
          <div className='d-flex align-items-start justify-content-between flex-wrap gap-2'>
            <div>
              <h4 className='fw-bold mb-1' style={{ color: '#033457' }}>
                {invoice.title}
              </h4>
              {invoice.projectName && (
                <p className='small mb-0' style={{ color: '#555' }}>
                  Project: {invoice.projectName}
                </p>
              )}
            </div>
            <div className='text-end'>
              <div className='fw-bold' style={{ fontSize: '24px', color: '#033457' }}>
                {formatCurrency(invoice.amount)}
              </div>
              {invoice.dueDate && (
                <span className='small' style={{ color: '#555' }}>
                  Due {formatDate(invoice.dueDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PAID Banner */}
      {isPaid && (
        <div
          className='d-flex align-items-center justify-content-center gap-2 mb-4 py-3 rounded'
          style={{ background: '#d4edda', border: '2px solid #28a745' }}
        >
          <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='#198754' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
            <polyline points='20 6 9 17 4 12' />
          </svg>
          <span className='fw-bold' style={{ color: '#155724', fontSize: '18px' }}>
            PAID
          </span>
          {invoice.paidAt && (
            <span className='fw-semibold' style={{ color: '#155724' }}>
              — {formatDate(invoice.paidAt)}
            </span>
          )}
        </div>
      )}

      {/* Line Items */}
      {lineItems.length > 0 && (
        <div className='card border-0 shadow-sm mb-4'>
          <div className='card-body'>
            <h6 className='fw-semibold mb-3' style={{ color: '#033457' }}>Items</h6>
            <div className='table-responsive'>
              <table className='table table-sm mb-0'>
                <thead>
                  <tr className='small' style={{ color: '#555' }}>
                    <th style={{ color: '#555' }}>Description</th>
                    <th className='text-center' style={{ color: '#555' }}>Qty</th>
                    <th className='text-end' style={{ color: '#555' }}>Unit Price</th>
                    <th className='text-end' style={{ color: '#555' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id} className='small'>
                      <td style={{ color: '#1a1a1a' }}>{item.description}</td>
                      <td className='text-center' style={{ color: '#1a1a1a' }}>{Number(item.quantity)}</td>
                      <td className='text-end' style={{ color: '#1a1a1a' }}>{formatCurrency(item.unitPrice)}</td>
                      <td className='text-end fw-medium' style={{ color: '#1a1a1a' }}>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className='fw-bold' style={{ color: '#033457' }}>
                    <td colSpan={3} className='text-end'>Total</td>
                    <td className='text-end'>{formatCurrency(invoice.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Description / Notes */}
      {invoice.description && (
        <div className='card border-0 shadow-sm mb-4'>
          <div className='card-body'>
            <h6 className='fw-semibold mb-2' style={{ color: '#033457' }}>Notes</h6>
            <p className='small mb-0' style={{ color: '#1a1a1a' }}>
              {invoice.description}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className='text-center mt-4 mb-5 invoice-no-print'>
        <p className='small mb-0' style={{ color: '#555' }}>
          Questions about this invoice? Email us at{' '}
          <a href='mailto:team@botmakers.ai' style={{ color: '#033457' }}>
            team@botmakers.ai
          </a>
        </p>
      </div>

      {/* Print-only footer */}
      <div className='invoice-print-footer'>
        <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '24px 0 12px' }} />
        <p style={{ color: '#666', fontSize: '11px', textAlign: 'center', margin: 0 }}>
          BotMakers Inc. &bull; botmakers.ai &bull; team@botmakers.ai &bull; 832.790.5001
        </p>
      </div>
    </PortalLayout>
  );
}
