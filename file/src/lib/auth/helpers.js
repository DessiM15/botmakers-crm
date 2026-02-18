import { createServerSupabaseClient } from '@/lib/db/client';
import { db } from '@/lib/db/client';
import { teamUsers, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Get the current Supabase session from cookies.
 * Returns { user } or null if no session.
 */
export async function getSession(cookieStore) {
  const supabase = createServerSupabaseClient(cookieStore);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { user };
}

/**
 * Get session + team_users record.
 * Returns { user, teamUser } or null.
 */
export async function getTeamUser(cookieStore) {
  const session = await getSession(cookieStore);
  if (!session) return null;

  const [teamUser] = await db
    .select()
    .from(teamUsers)
    .where(eq(teamUsers.id, session.user.id))
    .limit(1);

  if (!teamUser || !teamUser.isActive) return null;

  return { user: session.user, teamUser };
}

/**
 * Get session + clients record (by auth_user_id).
 * Returns { user, client } or null.
 */
export async function getClientUser(cookieStore) {
  const session = await getSession(cookieStore);
  if (!session) return null;

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.authUserId, session.user.id))
    .limit(1);

  if (!client) return null;

  return { user: session.user, client };
}

/**
 * Require authenticated team member. Throws if not.
 */
export async function requireTeam(cookieStore) {
  const result = await getTeamUser(cookieStore);
  if (!result) {
    throw new Error('CB-AUTH-003: Not a team member');
  }
  return result;
}

/**
 * Require admin role. Throws if not admin.
 */
export async function requireAdmin(cookieStore) {
  const result = await requireTeam(cookieStore);
  if (result.teamUser.role !== 'admin') {
    throw new Error('CB-AUTH-003: Admin access required');
  }
  return result;
}

/**
 * Require authenticated client. Throws if not.
 */
export async function requireClient(cookieStore) {
  const result = await getClientUser(cookieStore);
  if (!result) {
    throw new Error('CB-AUTH-003: Not a client');
  }
  return result;
}
