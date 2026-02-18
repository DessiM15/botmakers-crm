import postgres from 'postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  const info = {
    DATABASE_URL_set: !!process.env.DATABASE_URL,
    DATABASE_URL_host: process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
      : 'NOT SET',
  };

  // Test 1: Raw postgres connection (bypass Drizzle)
  try {
    const sql = postgres(process.env.DATABASE_URL, {
      prepare: false,
      ssl: 'require',
      connect_timeout: 10,
      idle_timeout: 5,
    });
    const rows = await sql`SELECT id, email FROM team_users LIMIT 1`;
    info.raw_postgres = 'OK';
    info.raw_row = rows[0] ? rows[0].email : 'no rows';
    await sql.end();
  } catch (err) {
    info.raw_postgres = 'FAILED';
    info.raw_error = err.message;
    info.raw_code = err.code;
    info.raw_cause = err.cause ? String(err.cause) : undefined;
    info.raw_errno = err.errno;
    info.raw_stack = err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : undefined;
  }

  // Test 2: DNS resolution check
  try {
    const dns = require('dns');
    const host = 'db.nqfgafvrxoqpnsakbtgw.supabase.co';
    const ipv4 = await new Promise((res, rej) => dns.resolve4(host, (e, a) => e ? rej(e) : res(a)));
    info.dns_ipv4 = ipv4;
  } catch (err) {
    info.dns_ipv4 = 'FAILED: ' + err.message;
  }

  try {
    const dns = require('dns');
    const host = 'db.nqfgafvrxoqpnsakbtgw.supabase.co';
    const ipv6 = await new Promise((res, rej) => dns.resolve6(host, (e, a) => e ? rej(e) : res(a)));
    info.dns_ipv6 = ipv6;
  } catch (err) {
    info.dns_ipv6 = 'FAILED: ' + err.message;
  }

  return NextResponse.json(info);
}
