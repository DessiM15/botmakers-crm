import { db } from '@/lib/db/client';
import { leads, teamUsers, contacts } from '@/lib/db/schema';
import { eq, asc, desc, isNull, ilike, or, and, sql, count } from 'drizzle-orm';

/**
 * Fetch all leads for the pipeline board.
 * Returns leads with their assigned team user info.
 * Treats NULL pipeline_stage as 'new_lead'.
 */
export async function getLeadsByStage() {
  const allLeads = await db
    .select({
      id: leads.id,
      fullName: leads.fullName,
      email: leads.email,
      companyName: leads.companyName,
      source: leads.source,
      score: leads.score,
      pipelineStage: leads.pipelineStage,
      pipelineStageChangedAt: leads.pipelineStageChangedAt,
      assignedTo: leads.assignedTo,
      createdAt: leads.createdAt,
      assignedName: teamUsers.fullName,
    })
    .from(leads)
    .leftJoin(teamUsers, eq(leads.assignedTo, teamUsers.id))
    .where(isNull(leads.convertedToClientId))
    .orderBy(asc(leads.pipelineStageChangedAt));

  // Group by pipeline stage, defaulting NULL to 'new_lead'
  const grouped = {};
  for (const lead of allLeads) {
    const stage = lead.pipelineStage || 'new_lead';
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push({ ...lead, pipelineStage: stage });
  }

  return grouped;
}

/**
 * Fetch all active team members for filter dropdown.
 */
export async function getTeamMembers() {
  return db
    .select({
      id: teamUsers.id,
      fullName: teamUsers.fullName,
    })
    .from(teamUsers)
    .where(eq(teamUsers.isActive, true))
    .orderBy(asc(teamUsers.fullName));
}

/**
 * Fetch paginated, filtered, searchable leads list.
 */
export async function getLeadsFiltered({
  search = '',
  source = 'all',
  score = 'all',
  stage = 'all',
  assignedTo = 'all',
  page = 1,
  perPage = 25,
  sortBy = 'createdAt',
  sortDir = 'desc',
} = {}) {
  const conditions = [];

  // Search across name, email, company
  if (search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(leads.fullName, term),
        ilike(leads.email, term),
        ilike(leads.companyName, term)
      )
    );
  }

  // Filter by source
  if (source !== 'all') {
    conditions.push(eq(leads.source, source));
  }

  // Filter by score
  if (score !== 'all') {
    conditions.push(eq(leads.score, score));
  }

  // Filter by stage
  if (stage !== 'all') {
    conditions.push(eq(leads.pipelineStage, stage));
  }

  // Filter by assigned_to
  if (assignedTo !== 'all') {
    conditions.push(eq(leads.assignedTo, assignedTo));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Sort column mapping
  const sortColumns = {
    createdAt: leads.createdAt,
    fullName: leads.fullName,
    email: leads.email,
    source: leads.source,
    score: leads.score,
    pipelineStage: leads.pipelineStage,
  };
  const sortCol = sortColumns[sortBy] || leads.createdAt;
  const orderFn = sortDir === 'asc' ? asc : desc;

  const offset = (page - 1) * perPage;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: leads.id,
        fullName: leads.fullName,
        email: leads.email,
        companyName: leads.companyName,
        source: leads.source,
        score: leads.score,
        pipelineStage: leads.pipelineStage,
        assignedTo: leads.assignedTo,
        assignedName: teamUsers.fullName,
        createdAt: leads.createdAt,
        convertedToClientId: leads.convertedToClientId,
      })
      .from(leads)
      .leftJoin(teamUsers, eq(leads.assignedTo, teamUsers.id))
      .where(whereClause)
      .orderBy(orderFn(sortCol))
      .limit(perPage)
      .offset(offset),
    db
      .select({ total: count() })
      .from(leads)
      .where(whereClause),
  ]);

  return {
    leads: rows,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Fetch a single lead by ID with full details.
 */
export async function getLeadById(id) {
  const [lead] = await db
    .select({
      id: leads.id,
      fullName: leads.fullName,
      email: leads.email,
      phone: leads.phone,
      companyName: leads.companyName,
      projectType: leads.projectType,
      projectTimeline: leads.projectTimeline,
      existingSystems: leads.existingSystems,
      referralSource: leads.referralSource,
      preferredContact: leads.preferredContact,
      projectDetails: leads.projectDetails,
      source: leads.source,
      score: leads.score,
      pipelineStage: leads.pipelineStage,
      pipelineStageChangedAt: leads.pipelineStageChangedAt,
      aiInternalAnalysis: leads.aiInternalAnalysis,
      aiProspectSummary: leads.aiProspectSummary,
      convertedToClientId: leads.convertedToClientId,
      assignedTo: leads.assignedTo,
      assignedName: teamUsers.fullName,
      notes: leads.notes,
      lastContactedAt: leads.lastContactedAt,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .leftJoin(teamUsers, eq(leads.assignedTo, teamUsers.id))
    .where(eq(leads.id, id))
    .limit(1);

  return lead || null;
}

/**
 * Fetch contacts (touchpoints) for a lead, newest first.
 */
export async function getLeadContacts(leadId) {
  return db
    .select({
      id: contacts.id,
      type: contacts.type,
      subject: contacts.subject,
      body: contacts.body,
      direction: contacts.direction,
      createdBy: contacts.createdBy,
      createdByName: teamUsers.fullName,
      createdAt: contacts.createdAt,
    })
    .from(contacts)
    .leftJoin(teamUsers, eq(contacts.createdBy, teamUsers.id))
    .where(eq(contacts.leadId, leadId))
    .orderBy(desc(contacts.createdAt));
}
