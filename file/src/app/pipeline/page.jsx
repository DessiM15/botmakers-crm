import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import PipelineBoard from '@/components/crm/PipelineBoard';
import { requireTeam } from '@/lib/auth/helpers';
import { getLeadsByStage, getTeamMembers } from '@/lib/db/queries/leads';

export const metadata = {
  title: 'Pipeline — Botmakers CRM',
};

const Page = async () => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  let leadsByStage = {}, teamMembers = [];
  try {
    [leadsByStage, teamMembers] = await Promise.all([
      getLeadsByStage(),
      getTeamMembers(),
    ]);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[Pipeline] Data fetch error:', err.message);
  }

  return (
    <MasterLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h5 className="text-xl fw-semibold mb-0 text-white">Pipeline</h5>
      </div>
      <PipelineBoard initialLeads={leadsByStage} teamMembers={teamMembers} />
    </MasterLayout>
  );
};

export default Page;
