import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import InvoiceTable from '@/components/crm/InvoiceTable';
import { requireTeam } from '@/lib/auth/helpers';
import { getInvoices, getInvoiceSummary } from '@/lib/db/queries/invoices';

export const metadata = {
  title: 'Invoices — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const search = params?.search || '';
  const status = params?.status || 'all';
  const page = parseInt(params?.page || '1', 10);

  let data = { invoices: [], total: 0, page: 1, perPage: 10, totalPages: 0 };
  let summary = { outstanding: 0, paidThisMonth: 0, overdue: 0 };
  try {
    [data, summary] = await Promise.all([
      getInvoices({ search, status, page }),
      getInvoiceSummary(),
    ]);
  } catch (err) {
    console.error('[Invoices] Data fetch error:', err.message);
  }

  return (
    <MasterLayout>
      <InvoiceTable
        invoices={data.invoices}
        total={data.total}
        page={data.page}
        perPage={data.perPage}
        totalPages={data.totalPages}
        currentStatus={status}
        currentSearch={search}
        summary={summary}
      />
    </MasterLayout>
  );
};

export default Page;
