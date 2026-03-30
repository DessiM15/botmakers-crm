import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import MasterLayout from '@/masterLayout/MasterLayout';
import ContactsTable from '@/components/crm/ContactsTable';
import { requireTeam } from '@/lib/auth/helpers';
import { getAllContacts } from '@/lib/db/queries/contacts';

export const metadata = {
  title: 'Contacts — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const params = await searchParams;

  let data = { contacts: [], total: 0, page: 1, perPage: 25, totalPages: 0 };
  try {
    data = await getAllContacts({
      search: params?.search || '',
      typeFilter: params?.type || 'all',
      page: parseInt(params?.page || '1', 10),
      perPage: parseInt(params?.perPage || '25', 10),
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Contacts] Data fetch error:', err.message);
    }
  }

  return (
    <MasterLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h5 className="text-xl fw-semibold mb-0 text-white">Contacts</h5>
      </div>
      <Suspense>
        <ContactsTable initialData={data} />
      </Suspense>
    </MasterLayout>
  );
};

export default Page;
