import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import EditableDocsList from '@/components/crm/EditableDocsList';
import DocumentVault from '@/components/crm/DocumentVault';
import DocsPageTabs from '@/components/crm/DocsPageTabs';
import { requireTeam } from '@/lib/auth/helpers';
import { getEditableDocs } from '@/lib/db/queries/editable-docs';
import { getAllDocuments } from '@/lib/db/queries/documents';

export const metadata = {
  title: 'Docs — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const sp = await searchParams;
  const tab = sp?.tab || 'uploaded';
  const search = sp?.search || '';
  const category = sp?.category || '';
  const entityType = sp?.entity_type || '';
  const page = parseInt(sp?.page) || 1;
  const perPage = 20;

  // Fetch data for the active tab
  let editableResult = { docs: [], total: 0 };
  let uploadedResult = { docs: [], total: 0 };

  try {
    [editableResult, uploadedResult] = await Promise.all([
      tab === 'editable'
        ? getEditableDocs({ search, category, entityType, page, perPage })
        : Promise.resolve({ docs: [], total: 0 }),
      tab === 'uploaded'
        ? getAllDocuments({ search, category, page, perPage })
        : Promise.resolve({ docs: [], total: 0 }),
    ]);
  } catch (err) {
    console.error('[docs page] Failed to fetch documents:', err);
  }

  return (
    <MasterLayout>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-24">
        <h6 className="fw-semibold mb-0">Documents</h6>
        <ul className="d-flex align-items-center gap-2">
          <li className="fw-medium">
            <a href="/" className="d-flex align-items-center gap-1 hover-text-primary">
              Dashboard
            </a>
          </li>
          <li>-</li>
          <li className="fw-medium">Docs</li>
        </ul>
      </div>

      <Suspense fallback={null}>
        <DocsPageTabs activeTab={tab} />
      </Suspense>

      {tab === 'uploaded' && (
        <DocumentVault
          documents={uploadedResult.docs}
          showContext={true}
        />
      )}

      {tab === 'editable' && (
        <EditableDocsList
          docs={editableResult.docs}
          total={editableResult.total}
          page={page}
          perPage={perPage}
          showEntityColumn={true}
        />
      )}
    </MasterLayout>
  );
};

export default Page;
