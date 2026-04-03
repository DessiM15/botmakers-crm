import MasterLayout from "@/masterLayout/MasterLayout";
import SettingsPage from "@/components/crm/SettingsPage";
import { isGitHubConfigured } from "@/lib/integrations/github";
import { isSquareConfigured, getSquareEnvironment } from "@/lib/integrations/square";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google-calendar";
import { isVercelBillingConfigured } from "@/lib/integrations/vercel-billing";
import { isAnthropicBillingConfigured } from "@/lib/integrations/anthropic-billing";
import { db } from "@/lib/db/client";
import { getStorageClient } from "@/lib/db/client";
import { teamUsers, systemSettings } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireTeam } from "@/lib/auth/helpers";

export const metadata = {
  title: "Settings — Botmakers CRM",
};

async function getSignedAvatarUrl(storagePath) {
  if (!storagePath) return null;
  try {
    const storage = getStorageClient();
    const { data } = await storage.createSignedUrl(storagePath, 86400);
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

const Page = async () => {
  const cookieStore = await cookies();
  let authResult;
  try {
    authResult = await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const currentTeamUser = authResult.teamUser;

  const githubConfigured = isGitHubConfigured();
  const squareConfigured = isSquareConfigured();
  const squareEnvironment = getSquareEnvironment();
  const googleCalendarConfigured = isGoogleCalendarConfigured();
  const calConfigured = !!process.env.CAL_WEBHOOK_SECRET;
  const vercelBillingConfigured = isVercelBillingConfigured();
  const anthropicBillingConfigured = isAnthropicBillingConfigured();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000');

  // Check current user's Google Calendar connection
  let googleCalendarConnected = false;
  let googleCalendarEmail = null;
  try {
    const [row] = await db
      .select({
        connected: teamUsers.googleCalendarConnected,
        email: teamUsers.googleCalendarEmail,
      })
      .from(teamUsers)
      .where(eq(teamUsers.id, currentTeamUser.id))
      .limit(1);
    if (row) {
      googleCalendarConnected = row.connected || false;
      googleCalendarEmail = row.email || null;
    }
  } catch {}

  // Fetch team members
  let members = [];
  try {
    members = await db
      .select()
      .from(teamUsers)
      .orderBy(asc(teamUsers.fullName));
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[Settings] Failed to fetch team members:', err.message);
  }

  // Generate signed avatar URLs for team members
  const membersWithAvatars = await Promise.all(
    members.map(async (m) => ({
      ...m,
      signedAvatarUrl: await getSignedAvatarUrl(m.avatarUrl),
    }))
  );

  // Get current user's signed avatar URL
  const currentUserAvatarUrl = await getSignedAvatarUrl(currentTeamUser.avatarUrl);

  // Fetch project tracking API key status
  let trackingKeyConfigured = false;
  let trackingKeyMasked = null;
  try {
    const [keyRow] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'project_tracking_api_key'));
    if (keyRow?.value?.key) {
      trackingKeyConfigured = true;
      const k = keyRow.value.key;
      trackingKeyMasked = k.length >= 12 ? k.slice(0, 9) + '...' + k.slice(-4) : '****';
    }
  } catch {}

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
        currentUser={{
          id: currentTeamUser.id,
          fullName: currentTeamUser.fullName,
          email: currentTeamUser.email,
          role: currentTeamUser.role,
          avatarUrl: currentUserAvatarUrl,
        }}
        githubConfigured={githubConfigured}
        squareConfigured={squareConfigured}
        squareEnvironment={squareEnvironment}
        calConfigured={calConfigured}
        googleCalendarConfigured={googleCalendarConfigured}
        googleCalendarConnected={googleCalendarConnected}
        googleCalendarEmail={googleCalendarEmail}
        siteUrl={siteUrl}
        teamMembers={membersWithAvatars}
        staleDays={staleDays}
        defaultProposalTerms={defaultProposalTerms}
        defaultProjectPhases={defaultProjectPhases}
        calendarColors={calendarColors}
        trackingKeyConfigured={trackingKeyConfigured}
        trackingKeyMasked={trackingKeyMasked}
        vercelBillingConfigured={vercelBillingConfigured}
        anthropicBillingConfigured={anthropicBillingConfigured}
      />
    </MasterLayout>
  );
};

export default Page;
