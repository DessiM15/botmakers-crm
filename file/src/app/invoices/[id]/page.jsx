import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import InvoiceDetail from '@/components/crm/InvoiceDetail';
import { requireTeam } from '@/lib/auth/helpers';
import { getInvoiceById } from '@/lib/db/queries/invoices';
import { isSquareConfigured } from '@/lib/integrations/square';
import { generateInvoiceViewUrl } from '@/lib/utils/formatters';

export async function generateMetadata({ params }) {
  try {
    const { id } = await params;
    const invoice = await getInvoiceById(id);
    return {
      title: invoice
        ? `${invoice.title} — Botmakers CRM`
        : 'Invoice Not Found — Botmakers CRM',
    };
  } catch {
    return { title: 'Invoice — Botmakers CRM' };
  }
}

const Page = async ({ params }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const { id } = await params;
  let invoice;
  try {
    invoice = await getInvoiceById(id);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[InvoiceDetail] Data fetch error:', err.message);
  }

  if (!invoice) {
    notFound();
  }

  const squareConfigured = isSquareConfigured();
  const publicViewUrl = generateInvoiceViewUrl(id);

  return (
    <MasterLayout>
      <InvoiceDetail invoice={invoice} squareConfigured={squareConfigured} publicViewUrl={publicViewUrl} />
    </MasterLayout>
  );
};

export default Page;
