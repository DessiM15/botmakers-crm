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
  try {
    const { id } = await params;
    const client = await getClientById(id);
    return {
      title: client
        ? `${client.fullName} — Botmakers CRM`
        : 'Client Not Found — Botmakers CRM',
    };
  } catch {
    return { title: 'Client — Botmakers CRM' };
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

  let client, clientProjects, clientProposals, clientInvoices;
  try {
    [client, clientProjects, clientProposals, clientInvoices] = await Promise.all([
      getClientById(id),
      getProjectsByClientId(id).catch(() => []),
      getProposalsByClientId(id).catch(() => []),
      getInvoicesByClientId(id).catch(() => []),
    ]);
  } catch {
    client = await getClientById(id).catch(() => null);
    clientProjects = [];
    clientProposals = [];
    clientInvoices = [];
  }

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
