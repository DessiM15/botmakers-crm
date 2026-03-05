import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import EditableDocEditor from '@/components/crm/EditableDocEditor';
import { requireTeam } from '@/lib/auth/helpers';
import { getEditableDocById } from '@/lib/db/queries/editable-docs';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const doc = await getEditableDocById(id);
  return {
    title: doc
      ? `${doc.title} — Botmakers CRM`
      : 'Document Not Found — Botmakers CRM',
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
  const doc = await getEditableDocById(id);

  if (!doc) {
    notFound();
  }

  return (
    <MasterLayout>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-24">
        <h6 className="fw-semibold mb-0">{doc.title}</h6>
        <ul className="d-flex align-items-center gap-2">
          <li className="fw-medium">
            <a href="/docs" className="d-flex align-items-center gap-1 hover-text-primary">
              Docs
            </a>
          </li>
          <li>-</li>
          <li className="fw-medium">Edit</li>
        </ul>
      </div>

      <EditableDocEditor
        doc={doc}
        entityType={doc.entityType}
        entityId={doc.entityId}
        entityName={doc.entityName || ''}
      />
    </MasterLayout>
  );
};

export default Page;
