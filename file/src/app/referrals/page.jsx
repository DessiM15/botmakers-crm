import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import ReferralTable from '@/components/crm/ReferralTable';
import { requireTeam } from '@/lib/auth/helpers';
import { getReferrers, getReferrerWithLeads } from '@/lib/db/queries/clients';

export const metadata = {
  title: 'Referrals — Botmakers CRM',
};

const Page = async () => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const referrers = await getReferrers();

  // Fetch leads for each referrer
  const referrerLeads = {};
  await Promise.all(
    referrers.map(async (ref) => {
      referrerLeads[ref.id] = await getReferrerWithLeads(ref.id);
    })
  );

  return (
    <MasterLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h5 className="text-xl fw-semibold mb-0 text-white">Referrals</h5>
      </div>
      <ReferralTable referrers={referrers} referrerLeads={referrerLeads} />
    </MasterLayout>
  );
};

export default Page;
