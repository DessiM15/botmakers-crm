import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import MeetingsList from '@/components/crm/MeetingsList';
import { requireTeam } from '@/lib/auth/helpers';
import { getMeetings } from '@/lib/db/queries/meetings';
import { getCalendarEventsList, deduplicateEvents } from '@/lib/db/queries/calendar-events';

export const metadata = {
  title: 'Meetings — Botmakers CRM',
};

const Page = async () => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  let meetings = [];
  try {
    const [crmMeetings, websiteEvents] = await Promise.all([
      getMeetings({ limit: 100 }),
      getCalendarEventsList({ limit: 100 }),
    ]);
    const uniqueWebsite = deduplicateEvents(crmMeetings, websiteEvents);
    meetings = [...crmMeetings, ...uniqueWebsite]
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  } catch {
    // Empty list on error
  }

  return (
    <MasterLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="text-white fw-semibold mb-0">Meetings</h4>
      </div>
      <MeetingsList meetings={meetings} />
    </MasterLayout>
  );
};

export default Page;
