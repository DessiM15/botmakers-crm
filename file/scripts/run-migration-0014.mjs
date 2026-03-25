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
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_created'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_booked'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_cancelled'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_rescheduled'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_completed'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_reminder'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'project_created'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_created'`,
  `ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL`,
];

for (const stmt of statements) {
  try {
    await sql.unsafe(stmt);
    console.log('OK:', stmt.substring(0, 70));
  } catch (e) {
    console.log('ERR:', e.message.substring(0, 100), '|', stmt.substring(0, 70));
  }
}

console.log('\nMigration 0014 complete.');
await sql.end();
process.exit(0);
