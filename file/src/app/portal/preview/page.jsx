import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { clients, projects } from '@/lib/db/schema';
import { eq, ne, desc, sql } from 'drizzle-orm';
import { getClientProjects } from '@/lib/db/queries/portal';
import { getPortalInvoices } from '@/lib/db/queries/portal';
import Link from 'next/link';
import PortalLayout from '@/components/crm/PortalLayout';

export const metadata = {
  title: 'Admin Preview — Botmakers Portal',
};

/**
 * Verify HMAC-SHA256 preview token.
 * Returns parsed payload or null if invalid/expired.
 */
async function verifyPreviewToken(token) {
  if (!token) return null;

  const secret = process.env.CRON_SECRET;
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;

  try {
    const crypto = await import('crypto');
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

    if (sig !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!payload.clientId) return null;

    return payload;
  } catch {
    return null;
  }
}

export default async function PortalPreviewPage({ searchParams }) {
  const { token } = await searchParams;
  const payload = await verifyPreviewToken(token);

  if (!payload) {
    notFound();
  }

  // Fetch client
  const [client] = await db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      email: clients.email,
      company: clients.company,
    })
    .from(clients)
    .where(eq(clients.id, payload.clientId))
    .limit(1);

  if (!client) notFound();

  // Fetch data
  const [clientProjects, clientInvoices] = await Promise.all([
    getClientProjects(client.id),
    getPortalInvoices(client.id),
  ]);

  const formatCurrency = (val) =>
    Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <PortalLayout isPreview={true} clientName={client.fullName}>
      {/* Projects */}
      <div className='mb-4'>
        <h4 className='fw-bold mb-1' style={{ color: '#033457' }}>
          Welcome back, {client.fullName.split(' ')[0]}
        </h4>
        <p className='text-muted mb-0'>Your active projects</p>
      </div>

      {clientProjects.length === 0 ? (
        <div className='card border-0 shadow-sm mb-4'>
          <div className='card-body text-center py-4'>
            <p className='text-muted small mb-0'>No active projects</p>
          </div>
        </div>
      ) : (
        <div className='row g-3 mb-4'>
          {clientProjects.map((project) => {
            const total = Number(project.totalMilestones);
            const completed = Number(project.completedMilestones);
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div key={project.id} className='col-md-6'>
                <div className='card border-0 shadow-sm h-100'>
                  <div className='card-body'>
                    <h6 className='fw-semibold mb-1' style={{ color: '#033457' }}>
                      {project.name}
                    </h6>
                    <p className='text-muted small mb-3'>
                      {project.projectType || 'Project'} &bull;{' '}
                      {project.status.replace(/_/g, ' ')}
                    </p>
                    <div className='d-flex align-items-center justify-content-between mb-1'>
                      <span className='small fw-medium' style={{ color: '#033457' }}>
                        Progress
                      </span>
                      <span className='small fw-bold' style={{ color: progress === 100 ? '#198754' : '#033457' }}>
                        {progress}%
                      </span>
                    </div>
                    <div className='progress' style={{ height: '8px', background: '#e9ecef' }}>
                      <div
                        className='progress-bar'
                        style={{
                          width: `${progress}%`,
                          background: progress === 100 ? '#198754' : '#03FF00',
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                    <p className='text-muted small mt-2 mb-0'>
                      {completed} of {total} milestones complete
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invoices */}
      <div className='mb-3'>
        <h5 className='fw-semibold' style={{ color: '#033457' }}>Invoices</h5>
      </div>

      {clientInvoices.length === 0 ? (
        <div className='card border-0 shadow-sm mb-4'>
          <div className='card-body text-center py-4'>
            <p className='text-muted small mb-0'>No invoices yet</p>
          </div>
        </div>
      ) : (
        <div className='card border-0 shadow-sm mb-4'>
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
                {clientInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className='small fw-medium' style={{ color: '#033457' }}>{inv.title}</td>
                    <td className='small fw-medium'>{formatCurrency(inv.amount)}</td>
                    <td>
                      <span
                        className='badge fw-medium'
                        style={{
                          background: inv.status === 'paid' ? '#19875422' : inv.status === 'overdue' ? '#dc354522' : '#0dcaf022',
                          color: inv.status === 'paid' ? '#198754' : inv.status === 'overdue' ? '#dc3545' : '#0dcaf0',
                        }}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className='text-muted small'>{formatDate(inv.dueDate)}</td>
                    <td className='text-end'>
                      {inv.status !== 'paid' && inv.squarePaymentUrl ? (
                        <span
                          className='btn btn-sm fw-medium disabled'
                          style={{ background: '#e9ecef', color: '#6c757d', border: 'none', fontSize: '12px', cursor: 'not-allowed' }}
                          title='Preview mode — payments disabled'
                        >
                          Pay
                        </span>
                      ) : inv.status === 'paid' ? (
                        <span className='text-muted small'>Paid {formatDate(inv.paidAt)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
