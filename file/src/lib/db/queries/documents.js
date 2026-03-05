import { db } from '@/lib/db/client';
import { documents } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * Fetch documents for a specific client.
 */
export async function getDocumentsByClientId(clientId) {
  return db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      fileSize: documents.fileSize,
      mimeType: documents.mimeType,
      storagePath: documents.storagePath,
      category: documents.category,
      description: documents.description,
      isPortalVisible: documents.isPortalVisible,
      createdAt: documents.createdAt,
      uploaderName: sql`(SELECT full_name FROM team_users WHERE team_users.id = ${documents.uploadedBy})`.as('uploader_name'),
    })
    .from(documents)
    .where(eq(documents.clientId, clientId))
    .orderBy(desc(documents.createdAt));
}

/**
 * Fetch documents for a specific project.
 */
export async function getDocumentsByProjectId(projectId) {
  return db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      fileSize: documents.fileSize,
      mimeType: documents.mimeType,
      storagePath: documents.storagePath,
      category: documents.category,
      description: documents.description,
      isPortalVisible: documents.isPortalVisible,
      createdAt: documents.createdAt,
      uploaderName: sql`(SELECT full_name FROM team_users WHERE team_users.id = ${documents.uploadedBy})`.as('uploader_name'),
    })
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .orderBy(desc(documents.createdAt));
}

/**
 * Fetch portal-visible documents for a project.
 */
export async function getPortalDocumentsByProjectId(projectId) {
  return db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      fileSize: documents.fileSize,
      mimeType: documents.mimeType,
      category: documents.category,
      description: documents.description,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.projectId, projectId),
        eq(documents.isPortalVisible, true)
      )
    )
    .orderBy(desc(documents.createdAt));
}

/**
 * Fetch a single document by ID.
 */
export async function getDocumentById(id) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  return doc || null;
}
