import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import InvoiceForm from '@/components/crm/InvoiceForm';
import { requireTeam } from '@/lib/auth/helpers';
import { getClientsForInvoiceDropdown } from '@/lib/db/queries/invoices';
import { isSquareConfigured } from '@/lib/integrations/square';

export const metadata = {
  title: 'Create Invoice — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const preselectedClientId = params?.client_id || null;
  const preselectedProjectId = params?.project_id || null;
  const preselectedMilestoneTitle = params?.milestone_title || null;
  const preselectedAmount = params?.amount || null;

  const clients = await getClientsForInvoiceDropdown();
  const squareConfigured = isSquareConfigured();

  return (
    <MasterLayout>
      <InvoiceForm
        clients={clients}
        preselectedClientId={preselectedClientId}
        preselectedProjectId={preselectedProjectId}
        preselectedMilestoneTitle={preselectedMilestoneTitle}
        preselectedAmount={preselectedAmount}
        squareConfigured={squareConfigured}
      />
    </MasterLayout>
  );
};

export default Page;
