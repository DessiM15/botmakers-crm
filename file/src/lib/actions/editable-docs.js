'use server';

import { db } from '@/lib/db/client';
import { editableDocs, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { editableDocCreateSchema, editableDocUpdateSchema } from '@/lib/utils/validators';
import { sanitizeHtml } from '@/lib/utils/sanitize';

/**
 * Create a new editable document.
 */
export async function createEditableDoc(data) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = editableDocCreateSchema.parse(data);

    const [doc] = await db
      .insert(editableDocs)
      .values({
        title: parsed.title.trim(),
        content: sanitizeHtml(parsed.content || ''),
        entityType: parsed.entityType,
        entityId: parsed.entityId || null,
        category: parsed.category,
        isPortalVisible: parsed.isPortalVisible,
        createdBy: teamUser.id,
        updatedBy: teamUser.id,
      })
      .returning({ id: editableDocs.id });

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'editable_doc.created',
      entityType: 'editable_doc',
      entityId: doc.id,
      metadata: { title: parsed.title, entityType: parsed.entityType },
    });

    revalidatePath('/docs');
    if (parsed.entityType === 'project' && parsed.entityId) {
      revalidatePath(`/projects/${parsed.entityId}`);
    }
    if (parsed.entityType === 'client' && parsed.entityId) {
      revalidatePath(`/clients/${parsed.entityId}`);
    }

    return { success: true, id: doc.id };
  } catch (error) {
    if (error?.issues) {
      return { success: false, error: error.issues[0]?.message || 'Validation failed' };
    }
    return { success: false, error: error.message || 'Failed to create document (CB-DB-001)' };
  }
}

/**
 * Update an existing editable document.
 */
export async function updateEditableDoc(docId, data) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = editableDocUpdateSchema.parse(data);

    const updates = {
      updatedBy: teamUser.id,
      lastEditedAt: new Date(),
      updatedAt: new Date(),
    };

    if (parsed.title !== undefined) updates.title = parsed.title.trim();
    if (parsed.content !== undefined) updates.content = sanitizeHtml(parsed.content);
    if (parsed.category !== undefined) updates.category = parsed.category;
    if (parsed.isPortalVisible !== undefined) updates.isPortalVisible = parsed.isPortalVisible;

    const [doc] = await db
      .update(editableDocs)
      .set(updates)
      .where(eq(editableDocs.id, docId))
      .returning({ id: editableDocs.id, entityType: editableDocs.entityType, entityId: editableDocs.entityId });

    if (!doc) {
      return { success: false, error: 'Document not found (CB-DB-002)' };
    }

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'editable_doc.updated',
      entityType: 'editable_doc',
      entityId: doc.id,
      metadata: { title: parsed.title },
    });

    revalidatePath('/docs');
    revalidatePath(`/docs/${docId}`);
    if (doc.entityType === 'project' && doc.entityId) {
      revalidatePath(`/projects/${doc.entityId}`);
    }
    if (doc.entityType === 'client' && doc.entityId) {
      revalidatePath(`/clients/${doc.entityId}`);
    }

    return { success: true };
  } catch (error) {
    if (error?.issues) {
      return { success: false, error: error.issues[0]?.message || 'Validation failed' };
    }
    return { success: false, error: error.message || 'Failed to update document (CB-DB-001)' };
  }
}

/**
 * Delete an editable document.
 */
export async function deleteEditableDoc(docId) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const [doc] = await db
      .delete(editableDocs)
      .where(eq(editableDocs.id, docId))
      .returning({ id: editableDocs.id, title: editableDocs.title, entityType: editableDocs.entityType, entityId: editableDocs.entityId });

    if (!doc) {
      return { success: false, error: 'Document not found (CB-DB-002)' };
    }

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'editable_doc.deleted',
      entityType: 'editable_doc',
      entityId: doc.id,
      metadata: { title: doc.title },
    });

    revalidatePath('/docs');
    if (doc.entityType === 'project' && doc.entityId) {
      revalidatePath(`/projects/${doc.entityId}`);
    }
    if (doc.entityType === 'client' && doc.entityId) {
      revalidatePath(`/clients/${doc.entityId}`);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to delete document (CB-DB-001)' };
  }
}
