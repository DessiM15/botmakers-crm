import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import ClientDetail from '@/components/crm/ClientDetail';
import { requireTeam } from '@/lib/auth/helpers';
import { getClientById } from '@/lib/db/queries/clients';
import { getProjectsByClientId } from '@/lib/db/queries/projects';
import { getProposalsByClientId } from '@/lib/db/queries/proposals';
import { getInvoicesByClientId } from '@/lib/db/queries/invoices';
import { getServicesByClientId } from '@/lib/db/queries/services';
import { getDocumentsByClientId } from '@/lib/db/queries/documents';
import { getEditableDocsByClientId } from '@/lib/db/queries/editable-docs';
import { getCostsByClientId, getClientPnL } from '@/lib/db/queries/costs';

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

  let client, clientProjects, clientProposals, clientInvoices, clientServices, clientDocuments, clientEditableDocs, clientCosts, clientPnL;
  try {
    [client, clientProjects, clientProposals, clientInvoices, clientServices, clientDocuments, clientEditableDocs, clientCosts, clientPnL] = await Promise.all([
      getClientById(id),
      getProjectsByClientId(id).catch(() => []),
      getProposalsByClientId(id).catch(() => []),
      getInvoicesByClientId(id).catch(() => []),
      getServicesByClientId(id).catch(() => []),
      getDocumentsByClientId(id).catch(() => []),
      getEditableDocsByClientId(id).catch(() => []),
      getCostsByClientId(id).catch(() => []),
      getClientPnL(id).catch(() => ({ revenue: 0, costs: 0, profit: 0, margin: 0 })),
    ]);
  } catch {
    client = await getClientById(id).catch(() => null);
    clientProjects = [];
    clientProposals = [];
    clientInvoices = [];
    clientServices = [];
    clientDocuments = [];
    clientEditableDocs = [];
    clientCosts = [];
    clientPnL = { revenue: 0, costs: 0, profit: 0, margin: 0 };
  }

  if (!client) {
    notFound();
  }

  return (
    <MasterLayout>
      <ClientDetail client={client} clientProjects={clientProjects} clientProposals={clientProposals} clientInvoices={clientInvoices} clientServices={clientServices} clientDocuments={clientDocuments} clientEditableDocs={clientEditableDocs} clientCosts={clientCosts} clientPnL={clientPnL} />
    </MasterLayout>
  );
};

export default Page;
