import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = postgres(databaseUrl, { prepare: false });

const statements = [
  `CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES team_users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, notification_type)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id)`,
];

for (const stmt of statements) {
  try {
    await sql.unsafe(stmt);
    console.log('OK:', stmt.substring(0, 70));
  } catch (e) {
    console.log('ERR:', e.message.substring(0, 100), '|', stmt.substring(0, 70));
  }
}

console.log('\nMigration 0016 complete.');
await sql.end();
process.exit(0);
