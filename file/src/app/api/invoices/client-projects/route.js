import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { getProjectsForClient } from '@/lib/db/queries/invoices';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ projects: [] });
    }

    const projects = await getProjectsForClient(clientId);
    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
