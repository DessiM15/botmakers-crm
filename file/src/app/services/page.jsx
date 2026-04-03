import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import ServiceTable from '@/components/crm/ServiceTable';
import { requireTeam } from '@/lib/auth/helpers';
import { getServices, getServiceSummary, getClientsForServiceDropdown } from '@/lib/db/queries/services';

export const metadata = {
  title: 'Services — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const sp = await searchParams;
  const search = sp?.search || '';
  const category = sp?.category || 'all';
  const status = sp?.status || 'all';
  const type = sp?.type || 'all';
  const page = parseInt(sp?.page || '1', 10);

  let data = { services: [], total: 0, page: 1, perPage: 10, totalPages: 0 };
  let summary = { totalMonthlyCost: 0, internalMonthlyCost: 0, clientMonthlyCost: 0, activeCount: 0, internalActiveCount: 0, clientActiveCount: 0, expiringCount: 0 };
  let clients = [];
  try {
    [data, summary, clients] = await Promise.all([
      getServices({ search, category, status, type, page, perPage: 10 }),
      getServiceSummary(),
      getClientsForServiceDropdown(),
    ]);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[Services] Data fetch error:', err.message);
  }

  return (
    <MasterLayout>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <h5 className="text-white fw-semibold mb-0">Services</h5>
      </div>
      <ServiceTable initialData={data} summary={summary} clients={clients} />
    </MasterLayout>
  );
};

export default Page;
