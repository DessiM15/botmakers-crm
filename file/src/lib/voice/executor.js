import { db } from '@/lib/db/client';
import { leads, clients, projects, projectMilestones, teamUsers } from '@/lib/db/schema';
import { ilike, or, eq, sql } from 'drizzle-orm';
import { updateLeadStage, updateLeadAssignment, createContact } from '@/lib/actions/leads';
import { updateProjectStatus } from '@/lib/actions/projects';

/**
 * Resolve a name to an entity ID by searching the database.
 */
async function resolveLeadByName(name) {
  const [lead] = await db
    .select({ id: leads.id, fullName: leads.fullName })
    .from(leads)
    .where(ilike(leads.fullName, `%${name}%`))
    .limit(1);
  return lead || null;
}

async function resolveClientByName(name) {
  const [client] = await db
    .select({ id: clients.id, fullName: clients.fullName })
    .from(clients)
    .where(
      or(
        ilike(clients.fullName, `%${name}%`),
        ilike(clients.company, `%${name}%`)
      )
    )
    .limit(1);
  return client || null;
}

async function resolveProjectByName(name) {
  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(ilike(projects.name, `%${name}%`))
    .limit(1);
  return project || null;
}

async function resolveTeamMemberByName(name) {
  const [member] = await db
    .select({ id: teamUsers.id, fullName: teamUsers.fullName })
    .from(teamUsers)
    .where(ilike(teamUsers.fullName, `%${name}%`))
    .limit(1);
  return member || null;
}

/**
 * Execute a voice action.
 * @param {string} action - Action name
 * @param {Object} params - Action parameters
 * @returns {Object} - { success, message } or { error }
 */
export async function executeVoiceAction(action, params) {
  try {
    switch (action) {
      case 'search_leads': {
        const results = await db
          .select({ id: leads.id, fullName: leads.fullName, email: leads.email, pipelineStage: leads.pipelineStage })
          .from(leads)
          .where(
            or(
              ilike(leads.fullName, `%${params.query}%`),
              ilike(leads.email, `%${params.query}%`),
              ilike(leads.companyName, `%${params.query}%`)
            )
          )
          .limit(5);
        return {
          success: true,
          message: results.length > 0
            ? `Found ${results.length} lead(s): ${results.map((r) => r.fullName).join(', ')}`
            : 'No leads found.',
          data: results,
        };
      }

      case 'search_clients': {
        const results = await db
          .select({ id: clients.id, fullName: clients.fullName, company: clients.company })
          .from(clients)
          .where(
            or(
              ilike(clients.fullName, `%${params.query}%`),
              ilike(clients.email, `%${params.query}%`),
              ilike(clients.company, `%${params.query}%`)
            )
          )
          .limit(5);
        return {
          success: true,
          message: results.length > 0
            ? `Found ${results.length} client(s): ${results.map((r) => r.fullName).join(', ')}`
            : 'No clients found.',
          data: results,
        };
      }

      case 'search_projects': {
        const results = await db
          .select({ id: projects.id, name: projects.name, status: projects.status })
          .from(projects)
          .where(ilike(projects.name, `%${params.query}%`))
          .limit(5);
        return {
          success: true,
          message: results.length > 0
            ? `Found ${results.length} project(s): ${results.map((r) => r.name).join(', ')}`
            : 'No projects found.',
          data: results,
        };
      }

      case 'get_pipeline_summary': {
        const result = await db.execute(sql`
          SELECT pipeline_stage, COUNT(*) as count
          FROM leads
          WHERE converted_to_client_id IS NULL
          GROUP BY pipeline_stage
          ORDER BY pipeline_stage
        `);
        const stages = result.rows || [];
        const summary = stages.map((s) => `${s.pipeline_stage.replace(/_/g, ' ')}: ${s.count}`).join(', ');
        return {
          success: true,
          message: summary || 'No leads in pipeline.',
        };
      }

      case 'update_lead_stage': {
        const lead = await resolveLeadByName(params.leadName);
        if (!lead) return { error: `Lead "${params.leadName}" not found` };

        const res = await updateLeadStage(lead.id, params.stage);
        if (res?.error) return { error: res.error };
        return { success: true, message: `Moved ${lead.fullName} to ${params.stage.replace(/_/g, ' ')}` };
      }

      case 'assign_lead': {
        const lead = await resolveLeadByName(params.leadName);
        if (!lead) return { error: `Lead "${params.leadName}" not found` };

        const member = await resolveTeamMemberByName(params.assigneeName);
        if (!member) return { error: `Team member "${params.assigneeName}" not found` };

        const res = await updateLeadAssignment(lead.id, member.id);
        if (res?.error) return { error: res.error };
        return { success: true, message: `Assigned ${lead.fullName} to ${member.fullName}` };
      }

      case 'update_milestone': {
        const project = await resolveProjectByName(params.projectName);
        if (!project) return { error: `Project "${params.projectName}" not found` };

        const [milestone] = await db
          .select()
          .from(projectMilestones)
          .where(
            ilike(projectMilestones.title, `%${params.milestoneTitle}%`)
          )
          .limit(1);

        if (!milestone) return { error: `Milestone "${params.milestoneTitle}" not found` };

        // Use direct DB update for voice commands (simplified)
        await db
          .update(projectMilestones)
          .set({
            status: params.status,
            completedAt: params.status === 'completed' ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(projectMilestones.id, milestone.id));

        return { success: true, message: `Updated "${milestone.title}" to ${params.status}` };
      }

      case 'create_contact_log': {
        // Try to find as lead first, then client
        let entityId = null;
        let entityType = null;
        const lead = await resolveLeadByName(params.entityName);
        if (lead) {
          entityId = lead.id;
          entityType = 'lead';
        } else {
          const client = await resolveClientByName(params.entityName);
          if (client) {
            entityId = client.id;
            entityType = 'client';
          }
        }

        if (!entityId) return { error: `"${params.entityName}" not found as a lead or client` };

        const contactData = {
          type: params.type || 'note',
          subject: params.subject || 'Voice command log',
          direction: params.direction || 'outbound',
        };
        if (entityType === 'lead') contactData.leadId = entityId;
        else contactData.clientId = entityId;

        const res = await createContact(contactData);
        if (res?.error) return { error: res.error };
        return { success: true, message: `Logged ${params.type || 'note'} for ${params.entityName}` };
      }

      case 'update_project_status': {
        const project = await resolveProjectByName(params.projectName);
        if (!project) return { error: `Project "${params.projectName}" not found` };

        const res = await updateProjectStatus(project.id, params.status);
        if (res?.error) return { error: res.error };
        return { success: true, message: `Updated ${project.name} to ${params.status}` };
      }

      case 'navigate': {
        return { success: true, message: `Navigating to ${params.path}`, navigate: params.path };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { error: `Action failed: ${error.message}` };
  }
}
