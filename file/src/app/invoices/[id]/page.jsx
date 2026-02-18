import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import InvoiceDetail from '@/components/crm/InvoiceDetail';
import { requireTeam } from '@/lib/auth/helpers';
import { getInvoiceById } from '@/lib/db/queries/invoices';
import { isSquareConfigured } from '@/lib/integrations/square';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  return {
    title: invoice
      ? `${invoice.title} — Botmakers CRM`
      : 'Invoice Not Found — Botmakers CRM',
  };
}

const Page = async ({ params }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const { id } = await params;
  const invoice = await getInvoiceById(id);

  if (!invoice) {
    notFound();
  }

  const squareConfigured = isSquareConfigured();

  return (
    <MasterLayout>
      <InvoiceDetail invoice={invoice} squareConfigured={squareConfigured} />
    </MasterLayout>
  );
};

export default Page;
