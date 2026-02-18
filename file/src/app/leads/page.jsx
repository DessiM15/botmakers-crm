import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import LeadTable from '@/components/crm/LeadTable';
import { requireTeam } from '@/lib/auth/helpers';
import { getLeadsFiltered, getTeamMembers } from '@/lib/db/queries/leads';

export const metadata = {
  title: 'Leads — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const params = await searchParams;

  const [data, teamMembers] = await Promise.all([
    getLeadsFiltered({
      search: params?.search || '',
      source: params?.source || 'all',
      score: params?.score || 'all',
      stage: params?.stage || 'all',
      assignedTo: params?.assignedTo || 'all',
      page: parseInt(params?.page || '1', 10),
      perPage: parseInt(params?.perPage || '25', 10),
    }),
    getTeamMembers(),
  ]);

  return (
    <MasterLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h5 className="text-xl fw-semibold mb-0 text-white">Leads</h5>
      </div>
      <LeadTable initialData={data} teamMembers={teamMembers} />
    </MasterLayout>
  );
};

export default Page;
