import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { generateSyncFile } from '@/lib/actions/repos';

export async function GET(request, { params }) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const { id } = await params;
    const result = await generateSyncFile(id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return new NextResponse(result.content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="BOTMAKERS-CRM.md"',
      },
    });
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to generate sync file' }, { status: 500 });
  }
}
