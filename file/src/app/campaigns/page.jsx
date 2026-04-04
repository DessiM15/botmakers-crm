import MasterLayout from '@/masterLayout/MasterLayout';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { getCampaigns } from '@/lib/db/queries/campaigns';
import CampaignManager from '@/components/crm/CampaignManager';

export const metadata = { title: 'Campaigns — Botmakers CRM' };

export default async function CampaignsPage({ searchParams }) {
  const cookieStore = await cookies();
  await requireTeam(cookieStore);

  const params = await searchParams;
  const search = params?.search || '';
  const status = params?.status || 'all';
  const page = Number(params?.page) || 1;

  const data = await getCampaigns({ search, status, page });

  return (
    <MasterLayout>
      <CampaignManager
        initialCampaigns={data.campaigns}
        initialTotal={data.total}
        initialPage={data.page}
        initialPerPage={data.perPage}
        initialSearch={search}
        initialStatus={status}
      />
    </MasterLayout>
  );
}
