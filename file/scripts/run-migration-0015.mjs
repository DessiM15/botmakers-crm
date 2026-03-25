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
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'client_created'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'proposal_created'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'proposal_sent'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_sent'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'lead_assigned'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_rescheduled'`,
  `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_cancelled'`,
];

for (const stmt of statements) {
  try {
    await sql.unsafe(stmt);
    console.log('OK:', stmt.substring(0, 70));
  } catch (e) {
    console.log('ERR:', e.message.substring(0, 100), '|', stmt.substring(0, 70));
  }
}

console.log('\nMigration 0015 complete.');
await sql.end();
process.exit(0);
