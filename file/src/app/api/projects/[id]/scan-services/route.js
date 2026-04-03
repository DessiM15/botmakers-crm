import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import { scanProjectServices } from '@/lib/actions/services';

export async function POST(request, { params }) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const { id } = await params;
    const result = await scanProjectServices(id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error.message?.startsWith('CB-AUTH')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'CB-INT-004: Failed to scan services' },
      { status: 500 }
    );
  }
}
