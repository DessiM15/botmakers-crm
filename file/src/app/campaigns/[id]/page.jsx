import MasterLayout from '@/masterLayout/MasterLayout';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { getCampaignById, getCampaignSends } from '@/lib/db/queries/campaigns';
import CampaignDetail from '@/components/crm/CampaignDetail';
import { notFound } from 'next/navigation';

export const metadata = { title: 'Campaign Detail — Botmakers CRM' };

export default async function CampaignDetailPage({ params, searchParams }) {
  const cookieStore = await cookies();
  await requireTeam(cookieStore);

  const { id } = await params;
  const sp = await searchParams;
  const sendPage = Number(sp?.sendPage) || 1;

  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const sendsData = await getCampaignSends({ campaignId: id, page: sendPage });

  return (
    <MasterLayout>
      <CampaignDetail
        campaign={campaign}
        sends={sendsData.sends}
        sendsTotal={sendsData.total}
        sendsPage={sendsData.page}
        sendsTotalPages={sendsData.totalPages}
      />
    </MasterLayout>
  );
}
