import { db } from '@/lib/db/client';
import { teamUsers } from '@/lib/db/schema';
import { NextResponse } from 'next/server';

export async function GET() {
  const info = {
    DATABASE_URL_set: !!process.env.DATABASE_URL,
    DATABASE_URL_host: process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
      : 'NOT SET',
  };

  try {
    const rows = await db.select({ id: teamUsers.id, email: teamUsers.email }).from(teamUsers).limit(1);
    info.drizzle = 'OK';
    info.row = rows[0] ? rows[0].email : 'no rows';
  } catch (err) {
    info.drizzle = 'FAILED';
    info.error = err.message;
    info.code = err.code;
  }

  return NextResponse.json(info);
}
