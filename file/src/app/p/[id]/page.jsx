import { notFound } from 'next/navigation';
import crypto from 'crypto';
import { getPublicProposal } from '@/lib/db/queries/portal';
import PortalLayout from '@/components/crm/PortalLayout';
import PortalProposalDetail from '@/components/crm/PortalProposalDetail';

export const metadata = {
  title: 'Proposal — BotMakers',
  robots: { index: false, follow: false },
};

export default async function PublicProposalPage({ params, searchParams }) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token || !id) notFound();

  // Verify HMAC token
  const secret = process.env.CRON_SECRET || 'fallback-secret';
  const expectedToken = crypto
    .createHmac('sha256', secret)
    .update(`proposal:${id}`)
    .digest('hex');

  const tokenBuf = Buffer.from(token, 'hex');
  const expectedBuf = Buffer.from(expectedToken, 'hex');

  if (
    tokenBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(tokenBuf, expectedBuf)
  ) {
    notFound();
  }

  let proposal;
  try {
    proposal = await getPublicProposal(id);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[PublicProposal] Data fetch error:', err.message);
  }

  if (!proposal) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const portalUrl = `${siteUrl}/portal/proposals/${id}`;

  return (
    <PortalLayout isPublic>
      <PortalProposalDetail
        proposal={proposal}
        clientName=""
        isPreview
      />
      <div className='text-center mt-4 mb-5'>
        <p className='text-muted small mb-3'>
          Ready to accept, request changes, or have questions?
        </p>
        <a
          href={portalUrl}
          className='btn btn-lg fw-semibold px-4'
          style={{ background: '#03FF00', color: '#033457', border: 'none' }}
        >
          Sign In to Respond
        </a>
      </div>
    </PortalLayout>
  );
}
