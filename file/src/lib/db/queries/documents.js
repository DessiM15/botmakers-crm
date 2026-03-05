import { db } from '@/lib/db/client';
import { documents } from '@/lib/db/schema';
import { eq, and, desc, sql, ilike, count as countFn } from 'drizzle-orm';

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
 * Fetch all uploaded documents (global view for /docs page).
 */
export async function getAllDocuments({ search = '', category = '', page = 1, perPage = 20 } = {}) {
  const conditions = [];

  if (search) {
    conditions.push(ilike(documents.fileName, `%${search}%`));
  }
  if (category) {
    conditions.push(eq(documents.category, category));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: documents.id,
        fileName: documents.fileName,
        fileSize: documents.fileSize,
        mimeType: documents.mimeType,
        storagePath: documents.storagePath,
        category: documents.category,
        description: documents.description,
        isPortalVisible: documents.isPortalVisible,
        clientId: documents.clientId,
        projectId: documents.projectId,
        createdAt: documents.createdAt,
        uploaderName: sql`(SELECT full_name FROM team_users WHERE team_users.id = ${documents.uploadedBy})`.as('uploader_name'),
        clientName: sql`(SELECT company FROM clients WHERE clients.id = ${documents.clientId})`.as('client_name'),
        projectName: sql`(SELECT name FROM projects WHERE projects.id = ${documents.projectId})`.as('project_name'),
      })
      .from(documents)
      .where(whereClause)
      .orderBy(desc(documents.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ total: countFn() })
      .from(documents)
      .where(whereClause),
  ]);

  return { docs: rows, total: Number(total) };
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
