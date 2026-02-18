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
  const { client } = await requireClient(cookieStore);
  const proposal = await getPortalProposal(id, client.id);

  if (!proposal) notFound();

  // Track view (non-blocking)
  await trackProposalView(id);

  return (
    <PortalLayout>
      <PortalProposalDetail
        proposal={proposal}
        clientName={client.fullName}
      />
    </PortalLayout>
  );
}
