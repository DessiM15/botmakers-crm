import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import MasterLayout from '@/masterLayout/MasterLayout';
import EmailGenerator from '@/components/crm/EmailGenerator';

export const metadata = {
  title: 'Email Generator | Botmakers CRM',
};

export default async function EmailGeneratorPage() {
  const cookieStore = await cookies();
  const { teamUser } = await requireTeam(cookieStore);

  return (
    <MasterLayout>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-24">
        <div>
          <h6 className="fw-semibold mb-0">Email Generator</h6>
          <span className="text-secondary-light text-sm">
            AI-powered email drafting for leads, clients, and prospects
          </span>
        </div>
      </div>
      <EmailGenerator teamUser={teamUser} />
    </MasterLayout>
  );
}
