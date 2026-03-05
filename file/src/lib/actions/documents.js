'use server';

import { db } from '@/lib/db/client';
import { documents, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getStorageClient } from '@/lib/db/client';

/**
 * Create a document record (called after upload).
 */
export async function createDocumentRecord(data) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [doc] = await db
      .insert(documents)
      .values({
        clientId: data.clientId || null,
        projectId: data.projectId || null,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        storagePath: data.storagePath,
        category: data.category || 'other',
        description: data.description || null,
        isPortalVisible: data.isPortalVisible || false,
        uploadedBy: teamUser.id,
      })
      .returning();

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'document.uploaded',
      entityType: data.projectId ? 'project' : 'client',
      entityId: data.projectId || data.clientId,
      metadata: { documentId: doc.id, fileName: data.fileName },
    });

    if (data.clientId) revalidatePath(`/clients/${data.clientId}`);
    if (data.projectId) revalidatePath(`/projects/${data.projectId}`);

    return { success: true, document: doc };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to create document record' };
  }
}

/**
 * Delete a document from storage and database.
 */
export async function deleteDocument(id) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    if (!doc) {
      return { error: 'CB-DB-002: Document not found' };
    }

    // Delete from storage
    try {
      const storage = getStorageClient();
      await storage.remove([doc.storagePath]);
    } catch {
      // Storage deletion may fail if file doesn't exist — continue
    }

    // Delete from database
    await db.delete(documents).where(eq(documents.id, id));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'document.deleted',
      entityType: doc.projectId ? 'project' : 'client',
      entityId: doc.projectId || doc.clientId,
      metadata: { documentId: id, fileName: doc.fileName },
    });

    if (doc.clientId) revalidatePath(`/clients/${doc.clientId}`);
    if (doc.projectId) revalidatePath(`/projects/${doc.projectId}`);

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to delete document' };
  }
}

/**
 * Toggle portal visibility of a document.
 */
export async function toggleDocumentPortalVisibility(id) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const [doc] = await db
      .select({ id: documents.id, isPortalVisible: documents.isPortalVisible, clientId: documents.clientId, projectId: documents.projectId })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    if (!doc) {
      return { error: 'CB-DB-002: Document not found' };
    }

    const newValue = !doc.isPortalVisible;

    await db
      .update(documents)
      .set({ isPortalVisible: newValue, updatedAt: new Date() })
      .where(eq(documents.id, id));

    if (doc.clientId) revalidatePath(`/clients/${doc.clientId}`);
    if (doc.projectId) revalidatePath(`/projects/${doc.projectId}`);

    return { success: true, isPortalVisible: newValue };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to toggle visibility' };
  }
}
