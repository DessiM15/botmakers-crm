import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import ProjectDetail from '@/components/crm/ProjectDetail';
import { requireTeam } from '@/lib/auth/helpers';
import { getProjectById } from '@/lib/db/queries/projects';
import { getInvoicesByProjectId } from '@/lib/db/queries/invoices';
import { getProjectQuestions } from '@/lib/db/queries/portal';
import { getServicesByProjectId } from '@/lib/db/queries/services';
import { getDocumentsByProjectId } from '@/lib/db/queries/documents';
import { getEditableDocsByProjectId } from '@/lib/db/queries/editable-docs';
import { getCostsByProjectId, getProjectPnL } from '@/lib/db/queries/costs';

export async function generateMetadata({ params }) {
  try {
    const { id } = await params;
    const project = await getProjectById(id);
    return {
      title: project
        ? `${project.name} — Botmakers CRM`
        : 'Project Not Found — Botmakers CRM',
    };
  } catch {
    return { title: 'Project — Botmakers CRM' };
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
  let project, projectInvoices = [], projectQuestions = [], projectServices = [], projectDocuments = [], projectEditableDocs = [], projectCosts = [], projectPnL = { revenue: 0, costs: 0, profit: 0, margin: 0 };
  try {
    [project, projectInvoices, projectQuestions, projectServices, projectDocuments, projectEditableDocs, projectCosts, projectPnL] = await Promise.all([
      getProjectById(id),
      getInvoicesByProjectId(id).catch(() => []),
      getProjectQuestions(id).catch(() => []),
      getServicesByProjectId(id).catch(() => []),
      getDocumentsByProjectId(id).catch(() => []),
      getEditableDocsByProjectId(id).catch(() => []),
      getCostsByProjectId(id).catch(() => []),
      getProjectPnL(id).catch(() => ({ revenue: 0, costs: 0, profit: 0, margin: 0 })),
    ]);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[ProjectDetail] Data fetch error:', err.message);
  }

  if (!project) {
    notFound();
  }

  return (
    <MasterLayout>
      <ProjectDetail project={project} projectInvoices={projectInvoices} projectQuestions={projectQuestions} projectServices={projectServices} projectDocuments={projectDocuments} projectEditableDocs={projectEditableDocs} projectCosts={projectCosts} projectPnL={projectPnL} />
    </MasterLayout>
  );
};

export default Page;
