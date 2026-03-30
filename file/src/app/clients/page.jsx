import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import ClientTable from '@/components/crm/ClientTable';
import { requireTeam } from '@/lib/auth/helpers';
import { getClients } from '@/lib/db/queries/clients';

export const metadata = {
  title: 'Clients — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const params = await searchParams;

  let data = { clients: [], total: 0, page: 1, perPage: 25, totalPages: 0 };
  try {
    data = await getClients({
      search: params?.search || '',
      page: parseInt(params?.page || '1', 10),
      perPage: parseInt(params?.perPage || '25', 10),
    });
  } catch (err) {
    console.error('[Clients] Data fetch error:', err.message);
  }

  return (
    <MasterLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h5 className="text-xl fw-semibold mb-0 text-white">Clients</h5>
      </div>
      <ClientTable initialData={data} />
    </MasterLayout>
  );
};

export default Page;
