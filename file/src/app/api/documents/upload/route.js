import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { getStorageClient, db } from '@/lib/db/client';
import { documents, activityLog } from '@/lib/db/schema';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/utils/constants';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const formData = await request.formData();
    const file = formData.get('file');
    const clientId = formData.get('clientId') || null;
    const projectId = formData.get('projectId') || null;
    const category = formData.get('category') || 'other';
    const description = formData.get('description') || null;
    const isPortalVisible = formData.get('isPortalVisible') === 'true';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'CB-API-001: File is required' }, { status: 400 });
    }

    if (!clientId && !projectId) {
      return NextResponse.json({ error: 'CB-API-001: Client or project is required' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'CB-API-001: File type not allowed' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'CB-API-001: File exceeds 50MB limit' }, { status: 400 });
    }

    // Sanitize filename
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const prefix = projectId ? `projects/${projectId}` : `clients/${clientId}`;
    const storagePath = `${prefix}/${timestamp}_${sanitized}`;

    // Upload to Supabase Storage
    const storage = getStorageClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await storage.upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ error: `CB-DB-001: Upload failed — ${uploadError.message}` }, { status: 500 });
    }

    // Insert DB record
    let doc;
    try {
      [doc] = await db
        .insert(documents)
        .values({
          clientId,
          projectId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storagePath,
          category,
          description,
          isPortalVisible,
          uploadedBy: teamUser.id,
        })
        .returning();
    } catch (dbError) {
      // Cleanup uploaded file if DB insert fails
      await storage.remove([storagePath]).catch(() => {});
      return NextResponse.json({ error: 'CB-DB-001: Failed to save document record' }, { status: 500 });
    }

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'document.uploaded',
      entityType: projectId ? 'project' : 'client',
      entityId: projectId || clientId,
      metadata: { documentId: doc.id, fileName: file.name },
    });

    return NextResponse.json({ success: true, document: doc });
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
