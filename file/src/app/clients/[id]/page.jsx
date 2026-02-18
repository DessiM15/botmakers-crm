import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import ClientDetail from '@/components/crm/ClientDetail';
import { requireTeam } from '@/lib/auth/helpers';
import { getClientById } from '@/lib/db/queries/clients';
import { getProjectsByClientId } from '@/lib/db/queries/projects';
import { getProposalsByClientId } from '@/lib/db/queries/proposals';
import { getInvoicesByClientId } from '@/lib/db/queries/invoices';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const client = await getClientById(id);
  return {
    title: client
      ? `${client.fullName} — Botmakers CRM`
      : 'Client Not Found — Botmakers CRM',
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
  const [client, clientProjects, clientProposals, clientInvoices] = await Promise.all([
    getClientById(id),
    getProjectsByClientId(id),
    getProposalsByClientId(id),
    getInvoicesByClientId(id),
  ]);

  if (!client) {
    notFound();
  }

  return (
    <MasterLayout>
      <ClientDetail client={client} clientProjects={clientProjects} clientProposals={clientProposals} clientInvoices={clientInvoices} />
    </MasterLayout>
  );
};

export default Page;
