import MasterLayout from '@/masterLayout/MasterLayout';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireTeam } from '@/lib/auth/helpers';
import { getProposals } from '@/lib/db/queries/proposals';
import ProposalList from '@/components/crm/ProposalList';

export const metadata = {
  title: 'Proposals — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();
  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const status = params?.status || 'all';
  const page = Number(params?.page) || 1;
  const search = params?.search || '';

  let data = { proposals: [], total: 0, page: 1, perPage: 10, totalPages: 0 };
  try {
    data = await getProposals({ status, page, search });
  } catch (err) {
    console.error('[Proposals] Data fetch error:', err.message);
  }

  return (
    <MasterLayout>
      <ProposalList
        proposals={data.proposals}
        total={data.total}
        page={data.page}
        perPage={data.perPage}
        totalPages={data.totalPages}
        currentStatus={status}
        currentSearch={search}
      />
    </MasterLayout>
  );
};

export default Page;
