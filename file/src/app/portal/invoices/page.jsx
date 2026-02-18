import { cookies } from 'next/headers';
import { requireClient } from '@/lib/auth/helpers';
import { getPortalInvoices } from '@/lib/db/queries/portal';
import PortalLayout from '@/components/crm/PortalLayout';
import Link from 'next/link';

export const metadata = {
  title: 'Invoices — Botmakers Portal',
};

const STATUS_COLORS = {
  sent: { bg: '#0dcaf022', color: '#0dcaf0' },
  viewed: { bg: '#0d6efd22', color: '#0d6efd' },
  paid: { bg: '#19875422', color: '#198754' },
  overdue: { bg: '#dc354522', color: '#dc3545' },
};

export default async function PortalInvoicesPage() {
  const cookieStore = await cookies();
  const { client } = await requireClient(cookieStore);
  const invoices = await getPortalInvoices(client.id);

  const formatCurrency = (val) =>
    Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <PortalLayout>
      <div className='mb-4'>
        <h4 className='fw-bold mb-1' style={{ color: '#033457' }}>
          Invoices
        </h4>
        <p className='text-muted small mb-0'>Your billing history</p>
      </div>

      {invoices.length === 0 ? (
        <div className='card border-0 shadow-sm'>
          <div className='card-body text-center py-5'>
            <h5 className='fw-semibold mb-2' style={{ color: '#033457' }}>
              No invoices yet
            </h5>
            <p className='text-muted small mb-0'>
              Your invoices will appear here once issued.
            </p>
          </div>
        </div>
      ) : (
        <div className='card border-0 shadow-sm'>
          <div className='table-responsive'>
            <table className='table table-hover mb-0'>
              <thead>
                <tr className='small text-muted'>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const statusStyle = STATUS_COLORS[inv.status] || { bg: '#6c757d22', color: '#6c757d' };
                  return (
                    <tr key={inv.id}>
                      <td>
                        <Link
                          href={`/portal/invoices/${inv.id}`}
                          className='text-decoration-none fw-medium small'
                          style={{ color: '#033457' }}
                        >
                          {inv.title}
                        </Link>
                      </td>
                      <td className='small fw-medium'>{formatCurrency(inv.amount)}</td>
                      <td>
                        <span
                          className='badge fw-medium'
                          style={{ background: statusStyle.bg, color: statusStyle.color }}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className='text-muted small'>{formatDate(inv.dueDate)}</td>
                      <td className='text-end'>
                        {inv.status !== 'paid' && inv.squarePaymentUrl ? (
                          <a
                            href={inv.squarePaymentUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='btn btn-sm fw-medium'
                            style={{ background: '#03FF00', color: '#033457', border: 'none', fontSize: '12px' }}
                          >
                            Pay
                          </a>
                        ) : inv.status === 'paid' ? (
                          <span className='text-muted small'>
                            Paid {formatDate(inv.paidAt)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
