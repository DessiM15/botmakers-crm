import { db } from '@/lib/db/client';
import { editableDocs, teamUsers } from '@/lib/db/schema';
import { eq, and, ilike, desc, count, sql } from 'drizzle-orm';

const creatorUser = teamUsers;

/**
 * Fetch paginated editable documents with optional filters.
 */
export async function getEditableDocs({ search = '', category = '', entityType = '', page = 1, perPage = 20 } = {}) {
  const conditions = [];

  if (search) {
    conditions.push(ilike(editableDocs.title, `%${search}%`));
  }
  if (category) {
    conditions.push(eq(editableDocs.category, category));
  }
  if (entityType) {
    conditions.push(eq(editableDocs.entityType, entityType));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * perPage;

  const [docs, [{ total }]] = await Promise.all([
    db
      .select({
        id: editableDocs.id,
        title: editableDocs.title,
        entityType: editableDocs.entityType,
        entityId: editableDocs.entityId,
        category: editableDocs.category,
        isPortalVisible: editableDocs.isPortalVisible,
        lastEditedAt: editableDocs.lastEditedAt,
        createdAt: editableDocs.createdAt,
        creatorName: sql`(SELECT full_name FROM team_users WHERE id = ${editableDocs.createdBy})`,
        updaterName: sql`(SELECT full_name FROM team_users WHERE id = ${editableDocs.updatedBy})`,
        entityName: sql`
          CASE
            WHEN ${editableDocs.entityType} = 'project' THEN (SELECT name FROM projects WHERE id = ${editableDocs.entityId})
            WHEN ${editableDocs.entityType} = 'client' THEN (SELECT full_name FROM clients WHERE id = ${editableDocs.entityId})
            ELSE NULL
          END
        `,
      })
      .from(editableDocs)
      .where(where)
      .orderBy(desc(editableDocs.lastEditedAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ total: count() })
      .from(editableDocs)
      .where(where),
  ]);

  return { docs, total, page, perPage };
}

/**
 * Fetch a single editable document by ID with creator/updater names.
 */
export async function getEditableDocById(id) {
  const [doc] = await db
    .select({
      id: editableDocs.id,
      title: editableDocs.title,
      content: editableDocs.content,
      entityType: editableDocs.entityType,
      entityId: editableDocs.entityId,
      category: editableDocs.category,
      isPortalVisible: editableDocs.isPortalVisible,
      createdBy: editableDocs.createdBy,
      updatedBy: editableDocs.updatedBy,
      lastEditedAt: editableDocs.lastEditedAt,
      createdAt: editableDocs.createdAt,
      updatedAt: editableDocs.updatedAt,
      creatorName: sql`(SELECT full_name FROM team_users WHERE id = ${editableDocs.createdBy})`,
      updaterName: sql`(SELECT full_name FROM team_users WHERE id = ${editableDocs.updatedBy})`,
      entityName: sql`
        CASE
          WHEN ${editableDocs.entityType} = 'project' THEN (SELECT name FROM projects WHERE id = ${editableDocs.entityId})
          WHEN ${editableDocs.entityType} = 'client' THEN (SELECT full_name FROM clients WHERE id = ${editableDocs.entityId})
          ELSE NULL
        END
      `,
    })
    .from(editableDocs)
    .where(eq(editableDocs.id, id))
    .limit(1);

  return doc || null;
}

/**
 * Fetch editable documents scoped to a project.
 */
export async function getEditableDocsByProjectId(projectId) {
  return db
    .select({
      id: editableDocs.id,
      title: editableDocs.title,
      category: editableDocs.category,
      isPortalVisible: editableDocs.isPortalVisible,
      lastEditedAt: editableDocs.lastEditedAt,
      createdAt: editableDocs.createdAt,
      creatorName: sql`(SELECT full_name FROM team_users WHERE id = ${editableDocs.createdBy})`,
      updaterName: sql`(SELECT full_name FROM team_users WHERE id = ${editableDocs.updatedBy})`,
    })
    .from(editableDocs)
    .where(and(eq(editableDocs.entityType, 'project'), eq(editableDocs.entityId, projectId)))
    .orderBy(desc(editableDocs.lastEditedAt));
}

/**
 * Fetch editable documents scoped to a client.
 */
export async function getEditableDocsByClientId(clientId) {
  return db
    .select({
      id: editableDocs.id,
      title: editableDocs.title,
      category: editableDocs.category,
      isPortalVisible: editableDocs.isPortalVisible,
      lastEditedAt: editableDocs.lastEditedAt,
      createdAt: editableDocs.createdAt,
      creatorName: sql`(SELECT full_name FROM team_users WHERE id = ${editableDocs.createdBy})`,
      updaterName: sql`(SELECT full_name FROM team_users WHERE id = ${editableDocs.updatedBy})`,
    })
    .from(editableDocs)
    .where(and(eq(editableDocs.entityType, 'client'), eq(editableDocs.entityId, clientId)))
    .orderBy(desc(editableDocs.lastEditedAt));
}
