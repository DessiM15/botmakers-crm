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

export async function generateMetadata({ params }) {
  const { id } = await params;
  const project = await getProjectById(id);
  return {
    title: project
      ? `${project.name} — Botmakers CRM`
      : 'Project Not Found — Botmakers CRM',
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
  const [project, projectInvoices, projectQuestions, projectServices, projectDocuments] = await Promise.all([
    getProjectById(id),
    getInvoicesByProjectId(id),
    getProjectQuestions(id),
    getServicesByProjectId(id).catch(() => []),
    getDocumentsByProjectId(id).catch(() => []),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <MasterLayout>
      <ProjectDetail project={project} projectInvoices={projectInvoices} projectQuestions={projectQuestions} projectServices={projectServices} projectDocuments={projectDocuments} />
    </MasterLayout>
  );
};

export default Page;
