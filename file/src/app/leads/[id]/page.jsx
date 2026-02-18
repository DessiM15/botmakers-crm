import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import LeadDetail from '@/components/crm/LeadDetail';
import { requireTeam } from '@/lib/auth/helpers';
import {
  getLeadById,
  getLeadContacts,
  getTeamMembers,
} from '@/lib/db/queries/leads';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const lead = await getLeadById(id);
  return {
    title: lead
      ? `${lead.fullName} — Botmakers CRM`
      : 'Lead Not Found — Botmakers CRM',
  };
}

const Page = async ({ params }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const { id } = await params;

  const [lead, contactLog, teamMembers] = await Promise.all([
    getLeadById(id),
    getLeadContacts(id),
    getTeamMembers(),
  ]);

  if (!lead) {
    notFound();
  }

  return (
    <MasterLayout>
      <LeadDetail lead={lead} contacts={contactLog} teamMembers={teamMembers} />
    </MasterLayout>
  );
};

export default Page;
