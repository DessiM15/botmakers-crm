import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireClient } from '@/lib/auth/helpers';
import { getPortalProposal } from '@/lib/db/queries/portal';
import { trackProposalView } from '@/lib/actions/portal';
import PortalLayout from '@/components/crm/PortalLayout';
import PortalProposalDetail from '@/components/crm/PortalProposalDetail';

export const metadata = {
  title: 'Proposal — Botmakers Portal',
};

export default async function PortalProposalPage({ params }) {
  const { id } = await params;
  const cookieStore = await cookies();
  let client;
  try {
    const result = await requireClient(cookieStore);
    client = result.client;
  } catch {
    const { redirect } = await import('next/navigation');
    redirect('/portal/login');
  }
  let proposal;
  try {
    proposal = await getPortalProposal(id, client.id);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[PortalProposal] Data fetch error:', err.message);
  }

  if (!proposal) notFound();

  // Track view (non-blocking)
  trackProposalView(id).catch(() => {});

  return (
    <PortalLayout>
      <Suspense fallback={null}>
        <PortalProposalDetail
          proposal={proposal}
          clientName={client.fullName}
        />
      </Suspense>
    </PortalLayout>
  );
}
