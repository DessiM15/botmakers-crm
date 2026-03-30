import MasterLayout from "@/masterLayout/MasterLayout";
import CalendarView from "@/components/crm/CalendarView";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireTeam } from "@/lib/auth/helpers";
import { getClientsForDropdown } from "@/lib/db/queries/projects";
import { db } from "@/lib/db/client";
import { leads, systemSettings } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const metadata = {
  title: "Calendar — Botmakers CRM",
};

const Page = async () => {
  const cookieStore = await cookies();
  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  let clients = [], leadRows = [], savedColors = null;
  try {
    const [c, l, settings] = await Promise.all([
      getClientsForDropdown().catch(() => []),
      db
        .select({ id: leads.id, fullName: leads.fullName, email: leads.email })
        .from(leads)
        .orderBy(desc(leads.createdAt))
        .catch(() => []),
      db
        .select({ key: systemSettings.key, value: systemSettings.value })
        .from(systemSettings)
        .catch(() => []),
    ]);
    clients = c;
    leadRows = l;
    for (const s of settings) {
      if (s.key === 'calendar_colors') savedColors = s.value;
    }
  } catch (err) {
    console.error('[Calendar] Data fetch error:', err.message);
  }

  return (
    <MasterLayout>
      <CalendarView
        clients={clients}
        leads={leadRows}
        savedColors={savedColors}
      />
    </MasterLayout>
  );
};

export default Page;
