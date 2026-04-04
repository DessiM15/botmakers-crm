import { db } from '@/lib/db/client';
import {
  campaigns,
  campaignSends,
  clients,
  leads,
  projects,
  projectPhases,
  projectMilestones,
  proposals,
  invoices,
  teamUsers,
} from '@/lib/db/schema';
import { eq, desc, and, count, sql, ilike, or, lte } from 'drizzle-orm';

/**
 * Fetch paginated campaigns list with send stats.
 */
export async function getCampaigns({
  search = '',
  status = 'all',
  page = 1,
  perPage = 25,
} = {}) {
  const conditions = [];

  if (status !== 'all') {
    conditions.push(eq(campaigns.status, status));
  }

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(ilike(campaigns.name, term));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * perPage;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        audienceType: campaigns.audienceType,
        type: campaigns.type,
        frequency: campaigns.frequency,
        sendDay: campaigns.sendDay,
        sendHour: campaigns.sendHour,
        status: campaigns.status,
        lastGeneratedAt: campaigns.lastGeneratedAt,
        nextSendAt: campaigns.nextSendAt,
        createdAt: campaigns.createdAt,
        createdByName: teamUsers.fullName,
        totalSent: sql`(SELECT COUNT(*) FROM campaign_sends WHERE campaign_sends.campaign_id = ${campaigns.id})`.as('total_sent'),
      })
      .from(campaigns)
      .leftJoin(teamUsers, eq(campaigns.createdBy, teamUsers.id))
      .where(whereClause)
      .orderBy(desc(campaigns.createdAt))
      .limit(perPage)
      .offset(offset),
    db.select({ total: count() }).from(campaigns).where(whereClause),
  ]);

  return {
    campaigns: rows,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Fetch a single campaign by ID with aggregate stats.
 */
export async function getCampaignById(id) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);

  if (!campaign) return null;

  const stats = await db
    .select({
      total: count(),
      sent: sql`COUNT(*) FILTER (WHERE ${campaignSends.status} != 'queued')`.as('sent'),
      delivered: sql`COUNT(*) FILTER (WHERE ${campaignSends.status} = 'delivered' OR ${campaignSends.status} = 'opened')`.as('delivered'),
      opened: sql`COUNT(*) FILTER (WHERE ${campaignSends.status} = 'opened')`.as('opened'),
      bounced: sql`COUNT(*) FILTER (WHERE ${campaignSends.status} = 'bounced')`.as('bounced'),
      complained: sql`COUNT(*) FILTER (WHERE ${campaignSends.status} = 'complained')`.as('complained'),
    })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, id));

  const [createdByUser] = await db
    .select({ fullName: teamUsers.fullName })
    .from(teamUsers)
    .where(eq(teamUsers.id, campaign.createdBy))
    .limit(1);

  return {
    ...campaign,
    createdByName: createdByUser?.fullName || 'Unknown',
    stats: stats[0] || { total: 0, sent: 0, delivered: 0, opened: 0, bounced: 0, complained: 0 },
  };
}

/**
 * Fetch paginated send history for a campaign.
 */
export async function getCampaignSends({
  campaignId,
  page = 1,
  perPage = 25,
} = {}) {
  const offset = (page - 1) * perPage;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(campaignSends)
      .where(eq(campaignSends.campaignId, campaignId))
      .orderBy(desc(campaignSends.createdAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ total: count() })
      .from(campaignSends)
      .where(eq(campaignSends.campaignId, campaignId)),
  ]);

  return {
    sends: rows,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Get active campaigns where next_send_at <= now.
 */
export async function getDueCampaigns() {
  return db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, 'active'),
        lte(campaigns.nextSendAt, new Date())
      )
    );
}

/**
 * Get clients eligible for campaigns (not opted out), max 100.
 */
export async function getEligibleClients() {
  return db
    .select({
      id: clients.id,
      email: clients.email,
      fullName: clients.fullName,
      company: clients.company,
      companyAnniversary: clients.companyAnniversary,
    })
    .from(clients)
    .where(
      and(
        eq(clients.emailCampaignsOptedOut, false),
        eq(clients.isDemo, false)
      )
    )
    .limit(100);
}

/**
 * Get leads eligible for campaigns (not opted out), max 100.
 */
export async function getEligibleLeads() {
  return db
    .select({
      id: leads.id,
      email: leads.email,
      fullName: leads.fullName,
      companyName: leads.companyName,
      pipelineStage: leads.pipelineStage,
      score: leads.score,
      lastContactedAt: leads.lastContactedAt,
    })
    .from(leads)
    .where(
      and(
        eq(leads.emailCampaignsOptedOut, false),
        eq(leads.isDemo, false),
        sql`${leads.convertedToClientId} IS NULL`
      )
    )
    .limit(100);
}

/**
 * Get rich context for AI email generation — client.
 */
export async function getClientCampaignContext(clientId) {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return null;

  const clientProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
    })
    .from(projects)
    .where(eq(projects.clientId, clientId))
    .limit(5);

  const milestones = clientProjects.length > 0
    ? await db
        .select({
          title: projectMilestones.title,
          status: projectMilestones.status,
          projectId: projectMilestones.projectId,
        })
        .from(projectMilestones)
        .where(
          sql`${projectMilestones.projectId} IN (${sql.join(clientProjects.map(p => sql`${p.id}`), sql`,`)})`
        )
        .orderBy(desc(projectMilestones.updatedAt))
        .limit(10)
    : [];

  const clientProposals = await db
    .select({
      title: proposals.title,
      status: proposals.status,
    })
    .from(proposals)
    .where(eq(proposals.clientId, clientId))
    .limit(5);

  const clientInvoices = await db
    .select({
      title: invoices.title,
      status: invoices.status,
      amount: invoices.amount,
    })
    .from(invoices)
    .where(eq(invoices.clientId, clientId))
    .limit(5);

  return {
    client,
    projects: clientProjects,
    milestones,
    proposals: clientProposals,
    invoices: clientInvoices,
  };
}

/**
 * Get rich context for AI email generation — lead.
 */
export async function getLeadCampaignContext(leadId) {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  return lead || null;
}

/**
 * Get a random eligible recipient for preview generation.
 */
export async function getRandomEligibleRecipient(audienceType) {
  if (audienceType === 'leads') {
    const [lead] = await db
      .select({
        id: leads.id,
        email: leads.email,
        fullName: leads.fullName,
        companyName: leads.companyName,
      })
      .from(leads)
      .where(
        and(
          eq(leads.emailCampaignsOptedOut, false),
          eq(leads.isDemo, false),
          sql`${leads.convertedToClientId} IS NULL`
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(1);
    return lead ? { ...lead, type: 'lead' } : null;
  }

  // Default to clients
  const [client] = await db
    .select({
      id: clients.id,
      email: clients.email,
      fullName: clients.fullName,
      company: clients.company,
    })
    .from(clients)
    .where(
      and(
        eq(clients.emailCampaignsOptedOut, false),
        eq(clients.isDemo, false)
      )
    )
    .orderBy(sql`RANDOM()`)
    .limit(1);
  return client ? { ...client, type: 'client' } : null;
}
