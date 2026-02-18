import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import ProjectForm from '@/components/crm/ProjectForm';
import { requireTeam } from '@/lib/auth/helpers';
import { getClientsForDropdown } from '@/lib/db/queries/projects';

export const metadata = {
  title: 'New Project — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const clients = await getClientsForDropdown();

  return (
    <MasterLayout>
      <div className="d-flex align-items-center gap-2 mb-4">
        <h5 className="text-xl fw-semibold mb-0 text-white">New Project</h5>
      </div>
      <ProjectForm
        clients={clients}
        defaultClientId={params?.client_id || ''}
        defaultLeadId={params?.lead_id || ''}
      />
    </MasterLayout>
  );
};

export default Page;
