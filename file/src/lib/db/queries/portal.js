import { db } from '@/lib/db/client';
import {
  projects,
  projectPhases,
  projectMilestones,
  projectDemos,
  projectQuestions,
  proposals,
  proposalLineItems,
  invoices,
  invoiceLineItems,
  payments,
  clients,
  leads,
  teamUsers,
} from '@/lib/db/schema';
import { eq, and, asc, desc, sql, ne, or } from 'drizzle-orm';

/**
 * Fetch all projects for a specific client (portal view).
 */
export async function getClientProjects(clientId) {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      projectType: projects.projectType,
      startDate: projects.startDate,
      targetEndDate: projects.targetEndDate,
      totalMilestones: sql`(SELECT COUNT(*) FROM project_milestones WHERE project_milestones.project_id = ${projects.id})`.as('total_milestones'),
      completedMilestones: sql`(SELECT COUNT(*) FROM project_milestones WHERE project_milestones.project_id = ${projects.id} AND project_milestones.status = 'completed')`.as('completed_milestones'),
    })
    .from(projects)
    .where(and(eq(projects.clientId, clientId), ne(projects.status, 'cancelled')))
    .orderBy(desc(projects.updatedAt));
}

/**
 * Fetch a single project for the portal (with phases, milestones, approved demos, questions).
 * Validates client ownership.
 */
export async function getPortalProject(projectId, clientId) {
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      projectType: projects.projectType,
      description: projects.description,
      startDate: projects.startDate,
      targetEndDate: projects.targetEndDate,
      clientId: projects.clientId,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.clientId, clientId)))
    .limit(1);

  if (!project) return null;

  const [phases, milestones, demos, questions] = await Promise.all([
    db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, projectId))
      .orderBy(asc(projectPhases.sortOrder)),
    db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId))
      .orderBy(asc(projectMilestones.sortOrder)),
    db
      .select()
      .from(projectDemos)
      .where(
        and(
          eq(projectDemos.projectId, projectId),
          eq(projectDemos.isApproved, true)
        )
      )
      .orderBy(desc(projectDemos.createdAt)),
    db
      .select({
        id: projectQuestions.id,
        questionText: projectQuestions.questionText,
        status: projectQuestions.status,
        replyText: projectQuestions.replyText,
        repliedAt: projectQuestions.repliedAt,
        repliedByName: sql`(SELECT team_users.full_name FROM team_users WHERE team_users.id = ${projectQuestions.repliedBy})`.as('replied_by_name'),
        createdAt: projectQuestions.createdAt,
      })
      .from(projectQuestions)
      .where(eq(projectQuestions.projectId, projectId))
      .orderBy(desc(projectQuestions.createdAt)),
  ]);

  const phasesWithMilestones = phases.map((phase) => ({
    ...phase,
    milestones: milestones.filter((m) => m.phaseId === phase.id),
  }));

  const totalMs = milestones.length;
  const completedMs = milestones.filter((m) => m.status === 'completed').length;
  const progress = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;

  const upcomingMilestones = milestones
    .filter((m) => m.status !== 'completed')
    .slice(0, 3);

  return {
    ...project,
    phases: phasesWithMilestones,
    totalMilestones: totalMs,
    completedMilestones: completedMs,
    progress,
    upcomingMilestones,
    demos,
    questions,
  };
}

/**
 * Fetch a proposal for the portal (validates client ownership).
 * Matches by clientId directly, OR by leadId where the lead was converted to this client.
 */
export async function getPortalProposal(proposalId, clientId) {
  const [proposal] = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      scopeOfWork: proposals.scopeOfWork,
      deliverables: proposals.deliverables,
      termsAndConditions: proposals.termsAndConditions,
      pricingType: proposals.pricingType,
      totalAmount: proposals.totalAmount,
      status: proposals.status,
      sentAt: proposals.sentAt,
      viewedAt: proposals.viewedAt,
      acceptedAt: proposals.acceptedAt,
      declinedAt: proposals.declinedAt,
      expiresAt: proposals.expiresAt,
      clientSignature: proposals.clientSignature,
      clientId: proposals.clientId,
      declineReason: proposals.declineReason,
      changeRequest: proposals.changeRequest,
      changeRequestedAt: proposals.changeRequestedAt,
    })
    .from(proposals)
    .where(
      and(
        eq(proposals.id, proposalId),
        or(
          eq(proposals.clientId, clientId),
          // Also match proposals linked to a lead that was converted to this client
          sql`${proposals.leadId} IN (SELECT ${leads.id} FROM ${leads} WHERE ${leads.convertedToClientId} = ${clientId})`
        )
      )
    )
    .limit(1);

  if (!proposal) return null;

  const lineItems = await db
    .select()
    .from(proposalLineItems)
    .where(eq(proposalLineItems.proposalId, proposalId))
    .orderBy(proposalLineItems.sortOrder);

  return { ...proposal, lineItems };
}

/**
 * Fetch a proposal for public (tokenized) view — no client auth required.
 * Excludes drafts (only sent/viewed/accepted/declined/etc. are visible).
 */
export async function getPublicProposal(proposalId) {
  const [proposal] = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      scopeOfWork: proposals.scopeOfWork,
      deliverables: proposals.deliverables,
      termsAndConditions: proposals.termsAndConditions,
      pricingType: proposals.pricingType,
      totalAmount: proposals.totalAmount,
      status: proposals.status,
      sentAt: proposals.sentAt,
      viewedAt: proposals.viewedAt,
      acceptedAt: proposals.acceptedAt,
      declinedAt: proposals.declinedAt,
      expiresAt: proposals.expiresAt,
      clientSignature: proposals.clientSignature,
      clientId: proposals.clientId,
      declineReason: proposals.declineReason,
      changeRequest: proposals.changeRequest,
      changeRequestedAt: proposals.changeRequestedAt,
    })
    .from(proposals)
    .where(
      and(
        eq(proposals.id, proposalId),
        ne(proposals.status, 'draft')
      )
    )
    .limit(1);

  if (!proposal) return null;

  const lineItems = await db
    .select()
    .from(proposalLineItems)
    .where(eq(proposalLineItems.proposalId, proposalId))
    .orderBy(proposalLineItems.sortOrder);

  return { ...proposal, lineItems };
}

/**
 * Fetch invoices for the portal (client's invoices only).
 */
export async function getPortalInvoices(clientId) {
  return db
    .select({
      id: invoices.id,
      title: invoices.title,
      amount: invoices.amount,
      status: invoices.status,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      squarePaymentUrl: invoices.squarePaymentUrl,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.clientId, clientId),
        ne(invoices.status, 'draft')
      )
    )
    .orderBy(desc(invoices.createdAt));
}

/**
 * Fetch a single invoice for the portal (validates client ownership).
 */
export async function getPortalInvoice(invoiceId, clientId) {
  const [invoice] = await db
    .select({
      id: invoices.id,
      title: invoices.title,
      description: invoices.description,
      amount: invoices.amount,
      status: invoices.status,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      squarePaymentUrl: invoices.squarePaymentUrl,
      squareInvoiceId: invoices.squareInvoiceId,
      clientId: invoices.clientId,
      createdAt: invoices.createdAt,
      projectName: sql`(SELECT projects.name FROM projects WHERE projects.id = ${invoices.projectId})`.as('project_name'),
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.clientId, clientId),
        ne(invoices.status, 'draft')
      )
    )
    .limit(1);

  if (!invoice) return null;

  const lineItemRows = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId))
    .orderBy(invoiceLineItems.sortOrder);

  return { ...invoice, lineItems: lineItemRows };
}

/**
 * Fetch an invoice for public (tokenized) view — no client auth required.
 * Excludes drafts (only sent/viewed/paid/overdue are visible).
 */
export async function getPublicInvoice(invoiceId) {
  const [invoice] = await db
    .select({
      id: invoices.id,
      title: invoices.title,
      description: invoices.description,
      amount: invoices.amount,
      status: invoices.status,
      dueDate: invoices.dueDate,
      sentAt: invoices.sentAt,
      viewedAt: invoices.viewedAt,
      paidAt: invoices.paidAt,
      clientId: invoices.clientId,
      createdAt: invoices.createdAt,
      projectName: sql`(SELECT projects.name FROM projects WHERE projects.id = ${invoices.projectId})`.as('project_name'),
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, invoiceId),
        ne(invoices.status, 'draft')
      )
    )
    .limit(1);

  if (!invoice) return null;

  const lineItemRows = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId))
    .orderBy(invoiceLineItems.sortOrder);

  return { ...invoice, lineItems: lineItemRows };
}

/**
 * Fetch questions for a project (CRM-side, with client names).
 */
export async function getProjectQuestions(projectId) {
  return db
    .select({
      id: projectQuestions.id,
      projectId: projectQuestions.projectId,
      clientId: projectQuestions.clientId,
      questionText: projectQuestions.questionText,
      status: projectQuestions.status,
      replyDraft: projectQuestions.replyDraft,
      replyText: projectQuestions.replyText,
      repliedBy: projectQuestions.repliedBy,
      repliedAt: projectQuestions.repliedAt,
      createdAt: projectQuestions.createdAt,
      clientName: sql`(SELECT clients.full_name FROM clients WHERE clients.id = ${projectQuestions.clientId})`.as('client_name'),
      repliedByName: sql`(SELECT team_users.full_name FROM team_users WHERE team_users.id = ${projectQuestions.repliedBy})`.as('replied_by_name'),
    })
    .from(projectQuestions)
    .where(eq(projectQuestions.projectId, projectId))
    .orderBy(desc(projectQuestions.createdAt));
}

/**
 * Fetch activity log entries (paginated, filtered).
 */
export async function getActivityLog({
  page = 1,
  perPage = 25,
  actorType = 'all',
  entityType = 'all',
  action = 'all',
  dateFrom = null,
  dateTo = null,
} = {}) {
  const conditions = [];

  if (actorType !== 'all') {
    conditions.push(sql`activity_log.actor_type = ${actorType}`);
  }
  if (entityType !== 'all') {
    conditions.push(sql`activity_log.entity_type = ${entityType}`);
  }
  if (action !== 'all') {
    conditions.push(sql`activity_log.action LIKE ${action + '%'}`);
  }
  if (dateFrom) {
    conditions.push(sql`al.created_at >= ${dateFrom}::timestamptz`);
  }
  if (dateTo) {
    conditions.push(sql`al.created_at < (${dateTo}::date + interval '1 day')`);
  }

  const whereStr = conditions.length > 0
    ? sql.join(conditions, sql` AND `)
    : undefined;

  const offset = (page - 1) * perPage;

  const entriesResult = await db.execute(sql`
    SELECT
      al.id,
      al.actor_id,
      al.actor_type,
      al.action,
      al.entity_type,
      al.entity_id,
      al.metadata,
      al.created_at,
      COALESCE(
        (SELECT tu.full_name FROM team_users tu WHERE tu.id = al.actor_id),
        (SELECT c.full_name FROM clients c WHERE c.id = al.actor_id),
        CASE WHEN al.actor_type = 'system' THEN 'System' ELSE 'Unknown' END
      ) AS actor_name
    FROM activity_log al
    ${whereStr ? sql`WHERE ${whereStr}` : sql``}
    ORDER BY al.created_at DESC
    LIMIT ${perPage} OFFSET ${offset}
  `);
  const rows = entriesResult.rows ?? [];

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM activity_log al
    ${whereStr ? sql`WHERE ${whereStr}` : sql``}
  `);
  const total = Number(countResult.rows?.[0]?.count ?? 0);

  return {
    entries: rows,
    total: Number(total),
    page,
    perPage,
    totalPages: Math.ceil(Number(total) / perPage),
  };
}
