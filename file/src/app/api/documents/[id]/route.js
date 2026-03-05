import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { getDocumentById } from '@/lib/db/queries/documents';
import { getStorageClient } from '@/lib/db/client';

export async function GET(request, { params }) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const { id } = await params;
    const doc = await getDocumentById(id);

    if (!doc) {
      return NextResponse.json({ error: 'CB-DB-002: Document not found' }, { status: 404 });
    }

    // Generate a signed URL (1 hour expiry)
    const storage = getStorageClient();
    const { data, error } = await storage.createSignedUrl(doc.storagePath, 3600);

    if (error) {
      return NextResponse.json({ error: 'CB-DB-001: Failed to generate download URL' }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl, fileName: doc.fileName });
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}
