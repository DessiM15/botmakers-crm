import MasterLayout from "@/masterLayout/MasterLayout";
import ActivityLogView from "@/components/crm/ActivityLogView";
import { getActivityLog } from "@/lib/db/queries/portal";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireTeam } from "@/lib/auth/helpers";

export const metadata = {
  title: "Activity Log — Botmakers CRM",
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();
  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const page = Number(params?.page) || 1;
  const actorType = params?.actor || 'all';
  const entityType = params?.entity || 'all';
  const action = params?.action || 'all';
  const dateFrom = params?.from || null;
  const dateTo = params?.to || null;

  let data = { entries: [], total: 0, page: 1, totalPages: 0 };
  try {
    data = await getActivityLog({
      page,
      perPage: 25,
      actorType,
      entityType,
      action,
      dateFrom,
      dateTo,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[Activity] Data fetch error:', err.message);
  }

  return (
    <MasterLayout>
      <ActivityLogView
        entries={data.entries}
        total={data.total}
        page={data.page}
        totalPages={data.totalPages}
        filters={{ actorType, entityType, action, dateFrom, dateTo }}
      />
    </MasterLayout>
  );
};

export default Page;
