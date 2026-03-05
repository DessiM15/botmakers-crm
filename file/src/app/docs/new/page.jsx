import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import EditableDocEditor from '@/components/crm/EditableDocEditor';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { projects, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const metadata = {
  title: 'New Document — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const sp = await searchParams;
  const entityType = sp?.entity_type || 'global';
  const entityId = sp?.entity_id || null;

  let entityName = '';
  if (entityType === 'project' && entityId) {
    const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, entityId)).limit(1);
    entityName = project?.name || '';
  } else if (entityType === 'client' && entityId) {
    const [client] = await db.select({ fullName: clients.fullName }).from(clients).where(eq(clients.id, entityId)).limit(1);
    entityName = client?.fullName || '';
  }

  return (
    <MasterLayout>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-24">
        <h6 className="fw-semibold mb-0">New Document</h6>
        <ul className="d-flex align-items-center gap-2">
          <li className="fw-medium">
            <a href="/docs" className="d-flex align-items-center gap-1 hover-text-primary">
              Docs
            </a>
          </li>
          <li>-</li>
          <li className="fw-medium">New</li>
        </ul>
      </div>

      <EditableDocEditor
        entityType={entityType}
        entityId={entityId}
        entityName={entityName}
      />
    </MasterLayout>
  );
};

export default Page;
