import { db } from '@/lib/db/client';
import {
  projects,
  projectPhases,
  projectMilestones,
  projectRepos,
  projectDemos,
  clients,
  teamUsers,
  activityLog,
} from '@/lib/db/schema';
import { eq, asc, desc, ilike, or, and, sql, count } from 'drizzle-orm';

/**
 * Fetch paginated, filtered, searchable projects list.
 */
export async function getProjects({
  search = '',
  status = 'all',
  clientId = 'all',
  page = 1,
  perPage = 25,
} = {}) {
  const conditions = [];

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(projects.name, term),
        ilike(clients.fullName, term),
        ilike(clients.company, term)
      )
    );
  }

  if (status !== 'all') {
    conditions.push(eq(projects.status, status));
  }

  if (clientId !== 'all') {
    conditions.push(eq(projects.clientId, clientId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * perPage;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
        clientName: clients.fullName,
        clientCompany: clients.company,
        projectType: projects.projectType,
        status: projects.status,
        pricingType: projects.pricingType,
        totalValue: projects.totalValue,
        startDate: projects.startDate,
        targetEndDate: projects.targetEndDate,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        totalMilestones: sql`(SELECT COUNT(*) FROM project_milestones WHERE project_milestones.project_id = ${projects.id})`.as('total_milestones'),
        completedMilestones: sql`(SELECT COUNT(*) FROM project_milestones WHERE project_milestones.project_id = ${projects.id} AND project_milestones.status = 'completed')`.as('completed_milestones'),
        currentPhase: sql`(SELECT pp.name FROM project_phases pp JOIN project_milestones pm ON pm.phase_id = pp.id WHERE pm.project_id = ${projects.id} AND pm.status IN ('pending', 'in_progress') ORDER BY pp.sort_order ASC, pm.sort_order ASC LIMIT 1)`.as('current_phase'),
        lastActivity: sql`(SELECT MAX(al.created_at) FROM activity_log al WHERE al.entity_type = 'project' AND al.entity_id = ${projects.id})`.as('last_activity'),
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(projects.updatedAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ total: count() })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(whereClause),
  ]);

  return {
    projects: rows,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Fetch a single project by ID with full details.
 */
export async function getProjectById(id) {
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientId: projects.clientId,
      clientName: clients.fullName,
      clientCompany: clients.company,
      proposalId: projects.proposalId,
      leadId: projects.leadId,
      projectType: projects.projectType,
      description: projects.description,
      status: projects.status,
      pricingType: projects.pricingType,
      totalValue: projects.totalValue,
      startDate: projects.startDate,
      targetEndDate: projects.targetEndDate,
      actualEndDate: projects.actualEndDate,
      createdBy: projects.createdBy,
      createdByName: teamUsers.fullName,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(teamUsers, eq(projects.createdBy, teamUsers.id))
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) return null;

  // Fetch phases with milestones
  const phases = await db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.projectId, id))
    .orderBy(asc(projectPhases.sortOrder));

  const milestones = await db
    .select()
    .from(projectMilestones)
    .where(eq(projectMilestones.projectId, id))
    .orderBy(asc(projectMilestones.sortOrder));

  // Group milestones by phase
  const phasesWithMilestones = phases.map((phase) => ({
    ...phase,
    milestones: milestones.filter((m) => m.phaseId === phase.id),
  }));

  // Calculate progress
  const totalMs = milestones.length;
  const completedMs = milestones.filter((m) => m.status === 'completed').length;
  const progress = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;

  // Fetch repos and demos
  const [repos, demos] = await Promise.all([
    db
      .select()
      .from(projectRepos)
      .where(eq(projectRepos.projectId, id))
      .orderBy(desc(projectRepos.createdAt)),
    db
      .select()
      .from(projectDemos)
      .where(eq(projectDemos.projectId, id))
      .orderBy(desc(projectDemos.createdAt)),
  ]);

  return {
    ...project,
    phases: phasesWithMilestones,
    totalMilestones: totalMs,
    completedMilestones: completedMs,
    progress,
    repos,
    demos,
  };
}

/**
 * Fetch projects for a specific client.
 */
export async function getProjectsByClientId(clientId) {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      projectType: projects.projectType,
      totalValue: projects.totalValue,
      startDate: projects.startDate,
      targetEndDate: projects.targetEndDate,
      createdAt: projects.createdAt,
      totalMilestones: sql`(SELECT COUNT(*) FROM project_milestones WHERE project_milestones.project_id = ${projects.id})`.as('total_milestones'),
      completedMilestones: sql`(SELECT COUNT(*) FROM project_milestones WHERE project_milestones.project_id = ${projects.id} AND project_milestones.status = 'completed')`.as('completed_milestones'),
      currentPhase: sql`(SELECT pp.name FROM project_phases pp JOIN project_milestones pm ON pm.phase_id = pp.id WHERE pm.project_id = ${projects.id} AND pm.status IN ('pending', 'in_progress') ORDER BY pp.sort_order ASC, pm.sort_order ASC LIMIT 1)`.as('current_phase'),
    })
    .from(projects)
    .where(eq(projects.clientId, clientId))
    .orderBy(desc(projects.createdAt));
}

/**
 * Fetch all clients for dropdown.
 */
export async function getClientsForDropdown() {
  return db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      company: clients.company,
    })
    .from(clients)
    .orderBy(asc(clients.fullName));
}
