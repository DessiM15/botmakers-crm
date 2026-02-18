/**
 * Apply RLS policies to the database.
 * Run: node src/lib/db/apply-rls.mjs (from file/ directory)
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = postgres(databaseUrl, { prepare: false });

async function apply() {
  const rlsSql = readFileSync('drizzle/0001_rls_policies.sql', 'utf-8');

  // Split on semicolons, strip comment-only lines, keep actual SQL
  const statements = rlsSql
    .split(';')
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter((s) => s.length > 0);

  console.log(`Applying ${statements.length} SQL statements...\n`);

  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      // Extract first meaningful line for logging
      const firstLine = stmt.split('\n').find((l) => l.trim() && !l.trim().startsWith('--')) || stmt.substring(0, 60);
      console.log(`  OK: ${firstLine.trim().substring(0, 80)}`);
    } catch (err) {
      if (err.code === '42710') {
        // Policy already exists — skip
        const name = err.message.match(/"([^"]+)"/)?.[1] || 'unknown';
        console.log(`  SKIP (exists): ${name}`);
      } else {
        console.error(`  FAIL: ${err.message}`);
        console.error(`  Statement: ${stmt.substring(0, 100)}...`);
      }
    }
  }

  console.log('\nRLS policies applied!');
  await sql.end();
  process.exit(0);
}

apply().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
