import MasterLayout from '@/masterLayout/MasterLayout';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { requireTeam } from '@/lib/auth/helpers';
import { getProposalById } from '@/lib/db/queries/proposals';
import ProposalDetail from '@/components/crm/ProposalDetail';

export const metadata = {
  title: 'Proposal Detail — Botmakers CRM',
};

const Page = async ({ params }) => {
  const cookieStore = await cookies();
  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const { id } = await params;
  let proposal;
  try {
    proposal = await getProposalById(id);
  } catch (err) {
    console.error('[ProposalDetail] Data fetch error:', err.message);
  }

  if (!proposal) {
    notFound();
  }

  return (
    <MasterLayout>
      <ProposalDetail proposal={proposal} />
    </MasterLayout>
  );
};

export default Page;
