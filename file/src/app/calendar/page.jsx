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

  const [clients, leadRows, settings] = await Promise.all([
    getClientsForDropdown(),
    db
      .select({ id: leads.id, fullName: leads.fullName, email: leads.email })
      .from(leads)
      .orderBy(desc(leads.createdAt)),
    db
      .select({ key: systemSettings.key, value: systemSettings.value })
      .from(systemSettings),
  ]);

  let savedColors = null;
  for (const s of settings) {
    if (s.key === 'calendar_colors') {
      savedColors = s.value;
    }
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
