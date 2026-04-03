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
import { getLeadFollowUps } from '@/lib/db/queries/follow-ups';

export async function generateMetadata({ params }) {
  try {
    const { id } = await params;
    const lead = await getLeadById(id);
    return {
      title: lead
        ? `${lead.fullName} — Botmakers CRM`
        : 'Lead Not Found — Botmakers CRM',
    };
  } catch {
    return { title: 'Lead — Botmakers CRM' };
  }
}

const Page = async ({ params }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const { id } = await params;

  let lead, contactLog = [], teamMembers = [], followUps = [];
  try {
    [lead, contactLog, teamMembers, followUps] = await Promise.all([
      getLeadById(id),
      getLeadContacts(id).catch(() => []),
      getTeamMembers().catch(() => []),
      getLeadFollowUps(id).catch(() => []),
    ]);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[LeadDetail] Data fetch error:', err.message);
  }

  if (!lead) {
    notFound();
  }

  return (
    <MasterLayout>
      <LeadDetail lead={lead} contacts={contactLog} teamMembers={teamMembers} followUps={followUps} />
    </MasterLayout>
  );
};

export default Page;
