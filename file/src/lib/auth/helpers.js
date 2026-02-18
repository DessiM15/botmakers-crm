import { createServerSupabaseClient, createAdminClient } from '@/lib/db/client';

/** Convert snake_case PostgREST row to camelCase to match Drizzle interface */
function toCamel(row) {
  if (!row) return row;
  const out = {};
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = row[key];
  }
  return out;
}

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

  const admin = createAdminClient();
  const { data: teamUser, error } = await admin
    .from('team_users')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !teamUser || !teamUser.is_active) return null;

  return { user: session.user, teamUser: toCamel(teamUser) };
}

/**
 * Get session + clients record (by auth_user_id).
 * Returns { user, client } or null.
 */
export async function getClientUser(cookieStore) {
  const session = await getSession(cookieStore);
  if (!session) return null;

  const admin = createAdminClient();
  const { data: client, error } = await admin
    .from('clients')
    .select('*')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  if (error || !client) return null;

  return { user: session.user, client: toCamel(client) };
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
