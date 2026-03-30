import MasterLayout from "@/masterLayout/MasterLayout";
import SettingsPage from "@/components/crm/SettingsPage";
import { isGitHubConfigured } from "@/lib/integrations/github";
import { isSquareConfigured, getSquareEnvironment } from "@/lib/integrations/square";
import { db } from "@/lib/db/client";
import { teamUsers, systemSettings } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireTeam } from "@/lib/auth/helpers";

export const metadata = {
  title: "Settings — Botmakers CRM",
};

const Page = async () => {
  const cookieStore = await cookies();
  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const githubConfigured = isGitHubConfigured();
  const squareConfigured = isSquareConfigured();
  const squareEnvironment = getSquareEnvironment();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000');

  // Fetch team members
  let members = [];
  try {
    members = await db
      .select()
      .from(teamUsers)
      .orderBy(asc(teamUsers.fullName));
  } catch (err) {
    console.error('[Settings] Failed to fetch team members:', err.message);
  }

  // Fetch settings
  let staleDays = 7;
  let defaultProposalTerms = '';
  let defaultProjectPhases = null;
  let calendarColors = null;
  try {
    const settings = await db
      .select({ key: systemSettings.key, value: systemSettings.value })
      .from(systemSettings);
    for (const s of settings) {
      if (s.key === 'stale_lead_days') staleDays = Number(s.value) || 7;
      if (s.key === 'default_proposal_terms') defaultProposalTerms = s.value || '';
      if (s.key === 'default_project_phases') defaultProjectPhases = s.value || null;
      if (s.key === 'calendar_colors') calendarColors = s.value || null;
    }
  } catch {}

  return (
    <MasterLayout>
      <SettingsPage
        githubConfigured={githubConfigured}
        squareConfigured={squareConfigured}
        squareEnvironment={squareEnvironment}
        siteUrl={siteUrl}
        teamMembers={members}
        staleDays={staleDays}
        defaultProposalTerms={defaultProposalTerms}
        defaultProjectPhases={defaultProjectPhases}
        calendarColors={calendarColors}
      />
    </MasterLayout>
  );
};

export default Page;
