import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireClient } from '@/lib/auth/helpers';
import { getPortalInvoice } from '@/lib/db/queries/portal';
import PortalLayout from '@/components/crm/PortalLayout';
import Link from 'next/link';

export const metadata = {
  title: 'Invoice — Botmakers Portal',
};

export default async function PortalInvoiceDetailPage({ params }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const { client } = await requireClient(cookieStore);
  const invoice = await getPortalInvoice(id, client.id);

  if (!invoice) notFound();

  const formatCurrency = (val) =>
    Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;

  const isPaid = invoice.status === 'paid';

  return (
    <PortalLayout>
      <div className='mb-2'>
        <Link href='/portal/invoices' className='text-decoration-none small' style={{ color: '#033457' }}>
          &larr; Back to Invoices
        </Link>
      </div>

      {/* Header */}
      <div className='card border-0 shadow-sm mb-4'>
        <div className='card-body'>
          <div className='d-flex align-items-start justify-content-between flex-wrap gap-2'>
            <div>
              <h4 className='fw-bold mb-1' style={{ color: '#033457' }}>
                {invoice.title}
              </h4>
              {invoice.projectName && (
                <p className='text-muted small mb-0'>
                  Project: {invoice.projectName}
                </p>
              )}
            </div>
            <div className='text-end'>
              <div className='fw-bold' style={{ fontSize: '24px', color: '#033457' }}>
                {formatCurrency(invoice.amount)}
              </div>
              {invoice.dueDate && (
                <span className='text-muted small'>
                  Due {formatDate(invoice.dueDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Paid status */}
      {isPaid && (
        <div className='alert border-0 mb-4' style={{ background: '#03FF0015', color: '#033457' }}>
          <div className='d-flex align-items-center gap-2'>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='#198754' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
              <polyline points='20 6 9 17 4 12' />
            </svg>
            <span className='fw-semibold'>
              Paid on {formatDate(invoice.paidAt)}
            </span>
          </div>
        </div>
      )}

      {/* Line Items */}
      {invoice.lineItems && invoice.lineItems.length > 0 && (
        <div className='card border-0 shadow-sm mb-4'>
          <div className='card-body'>
            <h6 className='fw-semibold mb-3' style={{ color: '#033457' }}>Items</h6>
            <div className='table-responsive'>
              <table className='table table-sm mb-0'>
                <thead>
                  <tr className='small text-muted'>
                    <th>Description</th>
                    <th className='text-center'>Qty</th>
                    <th className='text-end'>Price</th>
                    <th className='text-end'>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id} className='small'>
                      <td style={{ color: '#333' }}>{item.description}</td>
                      <td className='text-center'>{item.quantity}</td>
                      <td className='text-end'>{formatCurrency(item.unitPrice)}</td>
                      <td className='text-end fw-medium'>{formatCurrency(item.total)}</td>
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

      {/* Description */}
      {invoice.description && (
        <div className='card border-0 shadow-sm mb-4'>
          <div className='card-body'>
            <h6 className='fw-semibold mb-2' style={{ color: '#033457' }}>Notes</h6>
            <p className='small mb-0' style={{ color: '#333' }}>
              {invoice.description}
            </p>
          </div>
        </div>
      )}

      {/* Pay button */}
      {!isPaid && invoice.squarePaymentUrl && (
        <div className='text-center mt-4'>
          <a
            href={invoice.squarePaymentUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='btn btn-lg fw-semibold px-5'
            style={{ background: '#03FF00', color: '#033457', border: 'none' }}
          >
            Pay Now — {formatCurrency(invoice.amount)}
          </a>
        </div>
      )}
    </PortalLayout>
  );
}
