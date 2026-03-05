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
  const page = parseInt(sp?.page || '1', 10);

  const [data, summary, clients] = await Promise.all([
    getServices({ search, category, status, page, perPage: 10 }),
    getServiceSummary(),
    getClientsForServiceDropdown(),
  ]);

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
