/**
 * Seed script for Botmakers CRM team users.
 * Run: node src/lib/db/seed.js (from file/ directory)
 *
 * Creates 3 Supabase Auth accounts and matching team_users records.
 */

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

// Load env from .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
  console.error('Missing required environment variables. Ensure .env.local exists.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sql = postgres(databaseUrl, { prepare: false });

const TEAM_MEMBERS = [
  { email: 'dessiah@m.botmakers.ai', fullName: 'Dee', role: 'admin' },
  { email: 'jay@m.botmakers.ai', fullName: 'Jay', role: 'admin' },
  { email: 'tdaniel@botmakers.ai', fullName: 'Trent', role: 'admin' },
];

const PASSWORD = 'Botmakers2026!';

async function seed() {
  console.log('Seeding team users...\n');

  for (const member of TEAM_MEMBERS) {
    console.log(`Processing ${member.email}...`);

    // Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email === member.email
    );

    let userId;

    if (existing) {
      console.log(`  Auth user already exists: ${existing.id}`);
      userId = existing.id;

      // Update password in case it changed
      await supabase.auth.admin.updateUserById(userId, {
        password: PASSWORD,
      });
      console.log(`  Password updated.`);
    } else {
      // Create auth user
      const { data, error } = await supabase.auth.admin.createUser({
        email: member.email,
        password: PASSWORD,
        email_confirm: true,
      });

      if (error) {
        console.error(`  Failed to create auth user: ${error.message}`);
        continue;
      }

      userId = data.user.id;
      console.log(`  Auth user created: ${userId}`);
    }

    // Delete any stale team_users row with this email but wrong ID (from previous build)
    await sql`
      DELETE FROM team_users WHERE email = ${member.email} AND id != ${userId}
    `;

    // Upsert team_users record (using the auth user's ID)
    await sql`
      INSERT INTO team_users (id, email, full_name, role, is_active, created_at, updated_at)
      VALUES (${userId}, ${member.email}, ${member.fullName}, ${member.role}, true, now(), now())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = true,
        updated_at = now()
    `;
    console.log(`  team_users record upserted.\n`);
  }

  console.log('Seed complete!');
  await sql.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
