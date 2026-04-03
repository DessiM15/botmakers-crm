import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import { getStorageClient, createAdminClient } from '@/lib/db/client';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Use JPG, PNG, or WebP.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 2MB.' },
        { status: 400 }
      );
    }

    const storage = getStorageClient();
    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const fileName = `avatars/${teamUser.id}_${Date.now()}.${ext}`;

    // Delete old avatar if exists
    if (teamUser.avatarUrl) {
      await storage.remove([teamUser.avatarUrl]).catch(() => {});
    }

    // Upload new avatar
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await storage.upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json(
        { error: 'Failed to upload avatar.' },
        { status: 500 }
      );
    }

    // Update team_users.avatar_url with the storage path
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from('team_users')
      .update({ avatar_url: fileName, updated_at: new Date().toISOString() })
      .eq('id', teamUser.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update profile.' },
        { status: 500 }
      );
    }

    // Generate signed URL for immediate display
    const { data: signed } = await storage.createSignedUrl(fileName, 86400);

    return NextResponse.json({
      success: true,
      avatarUrl: signed?.signedUrl || null,
      storagePath: fileName,
    });
  } catch (err) {
    if (err?.message?.includes('CB-AUTH')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
