import MasterLayout from '@/masterLayout/MasterLayout';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireTeam } from '@/lib/auth/helpers';
import { getLeadsAndClientsForDropdown } from '@/lib/db/queries/proposals';
import ProposalWizard from '@/components/crm/ProposalWizard';

export const metadata = {
  title: 'New Proposal — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();
  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const leadId = params?.lead_id || null;

  const { leads, clients } = await getLeadsAndClientsForDropdown();

  return (
    <MasterLayout>
      <ProposalWizard
        leads={leads}
        clients={clients}
        preselectedLeadId={leadId}
      />
    </MasterLayout>
  );
};

export default Page;
