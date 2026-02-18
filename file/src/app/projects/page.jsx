import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import MasterLayout from '@/masterLayout/MasterLayout';
import ProjectList from '@/components/crm/ProjectList';
import { requireTeam } from '@/lib/auth/helpers';
import { getProjects, getClientsForDropdown } from '@/lib/db/queries/projects';

export const metadata = {
  title: 'Projects — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const params = await searchParams;

  const [data, clientOptions] = await Promise.all([
    getProjects({
      search: params?.search || '',
      status: params?.status || 'all',
      clientId: params?.clientId || 'all',
      page: parseInt(params?.page || '1', 10),
      perPage: 24,
    }),
    getClientsForDropdown(),
  ]);

  return (
    <MasterLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h5 className="text-xl fw-semibold mb-0 text-white">Projects</h5>
        <Link href="/projects/new" className="btn btn-primary btn-sm d-flex align-items-center gap-1">
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
          New Project
        </Link>
      </div>
      <ProjectList initialData={data} clientOptions={clientOptions} />
    </MasterLayout>
  );
};

export default Page;
