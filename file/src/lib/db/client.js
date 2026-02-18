import { createBrowserClient as createSupaBrowserClient } from '@supabase/ssr';
import { createServerClient as createSupaServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Browser client — for client components
export function createBrowserClient() {
  return createSupaBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Server client — for server components and actions (respects RLS)
export function createServerSupabaseClient(cookieStore) {
  return createSupaServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    }
  );
}

// Admin client — bypasses RLS using service role key
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Drizzle ORM client — lazy init so build doesn't crash without DATABASE_URL
let _db;
function getDb() {
  if (!_db) {
    const queryClient = postgres(process.env.DATABASE_URL, { prepare: false });
    _db = drizzle(queryClient, { schema });
  }
  return _db;
}

// Convenience export — getter disguised as a constant via Proxy
export const db = new Proxy({}, {
  get(_, prop) {
    const target = getDb();
    const value = target[prop];
    if (typeof value === 'function') {
      return value.bind(target);
    }
    return value;
  },
});
