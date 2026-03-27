import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import NotificationCenter from '@/components/crm/NotificationCenter';
import { requireTeam } from '@/lib/auth/helpers';

export const metadata = {
  title: 'Notifications — Botmakers CRM',
};

const Page = async () => {
  const cookieStore = await cookies();
  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  return (
    <MasterLayout>
      <NotificationCenter />
    </MasterLayout>
  );
};

export default Page;
