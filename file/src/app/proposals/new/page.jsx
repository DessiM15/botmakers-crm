import MasterLayout from '@/masterLayout/MasterLayout';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireTeam } from '@/lib/auth/helpers';
import { getLeadsAndClientsForDropdown, getProposalById } from '@/lib/db/queries/proposals';
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
  const editId = params?.edit_id || null;

  let leads = [], clients = [];
  try {
    const dropdown = await getLeadsAndClientsForDropdown();
    leads = dropdown.leads;
    clients = dropdown.clients;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('[ProposalNew] Failed to load dropdown data:', error);
  }

  let editProposal = null;
  if (editId) {
    try {
      editProposal = await getProposalById(editId);
      if (editProposal && editProposal.status !== 'draft') {
        editProposal = null;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('[ProposalNew] Failed to load proposal for editing:', error);
    }
  }

  return (
    <MasterLayout>
      <ProposalWizard
        leads={leads}
        clients={clients}
        preselectedLeadId={leadId}
        editProposal={editProposal}
      />
    </MasterLayout>
  );
};

export default Page;
