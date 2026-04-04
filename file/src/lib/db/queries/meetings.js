import { db } from '@/lib/db/client';
import { meetings, clients, leads, projects } from '@/lib/db/schema';
import { eq, and, gte, lte, ne, or, asc, desc, sql, ilike } from 'drizzle-orm';
import { isDemoMode } from '@/lib/utils/demo';

/**
 * Get meetings for a specific date (for dashboard "today" widget).
 */
export async function getMeetingsForDate(date) {
  const isDemo = await isDemoMode();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return db
    .select({
      id: meetings.id,
      title: meetings.title,
      startTime: meetings.startTime,
      endTime: meetings.endTime,
      meetingUrl: meetings.meetingUrl,
      attendeeName: meetings.attendeeName,
      attendeeEmail: meetings.attendeeEmail,
      status: meetings.status,
      source: meetings.source,
      clientId: meetings.clientId,
      leadId: meetings.leadId,
      projectId: meetings.projectId,
    })
    .from(meetings)
    .where(
      and(
        gte(meetings.startTime, dayStart),
        lte(meetings.startTime, dayEnd),
        ne(meetings.status, 'cancelled'),
        eq(meetings.isDemo, isDemo)
      )
    )
    .orderBy(asc(meetings.startTime));
}

/**
 * Get meetings for a date range (for FullCalendar views).
 */
export async function getMeetingsForRange(start, end) {
  const isDemo = await isDemoMode();
  return db
    .select({
      id: meetings.id,
      title: meetings.title,
      description: meetings.description,
      startTime: meetings.startTime,
      endTime: meetings.endTime,
      meetingUrl: meetings.meetingUrl,
      attendeeName: meetings.attendeeName,
      attendeeEmail: meetings.attendeeEmail,
      status: meetings.status,
      source: meetings.source,
      clientId: meetings.clientId,
      leadId: meetings.leadId,
      projectId: meetings.projectId,
    })
    .from(meetings)
    .where(
      and(
        gte(meetings.startTime, new Date(start)),
        lte(meetings.endTime, new Date(end)),
        eq(meetings.isDemo, isDemo)
      )
    )
    .orderBy(asc(meetings.startTime));
}

/**
 * Get next N upcoming meetings (for sidebar / widgets).
 */
export async function getUpcomingMeetings(limit = 5) {
  const isDemo = await isDemoMode();
  return db
    .select({
      id: meetings.id,
      title: meetings.title,
      startTime: meetings.startTime,
      endTime: meetings.endTime,
      meetingUrl: meetings.meetingUrl,
      attendeeName: meetings.attendeeName,
      attendeeEmail: meetings.attendeeEmail,
      status: meetings.status,
      source: meetings.source,
    })
    .from(meetings)
    .where(
      and(
        gte(meetings.startTime, new Date()),
        or(eq(meetings.status, 'scheduled'), eq(meetings.status, 'rescheduled')),
        eq(meetings.isDemo, isDemo)
      )
    )
    .orderBy(asc(meetings.startTime))
    .limit(limit);
}

/**
 * Get a single meeting by ID.
 */
export async function getMeetingById(id) {
  const isDemo = await isDemoMode();
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.isDemo, isDemo)))
    .limit(1);
  return meeting || null;
}

/**
 * Get a meeting by Cal.com booking UID (for dedup).
 */
export async function getMeetingByCalcomUid(uid) {
  const isDemo = await isDemoMode();
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.calcomBookingUid, uid), eq(meetings.isDemo, isDemo)))
    .limit(1);
  return meeting || null;
}

/**
 * Get paginated meetings with filters (for admin meetings list page).
 */
export async function getMeetings({ status, search, limit = 50, offset = 0 } = {}) {
  const isDemo = await isDemoMode();
  const conditions = [eq(meetings.isDemo, isDemo)];

  if (status) {
    conditions.push(eq(meetings.status, status));
  }

  if (search) {
    conditions.push(
      or(
        ilike(meetings.title, `%${search}%`),
        ilike(meetings.attendeeName, `%${search}%`),
        ilike(meetings.attendeeEmail, `%${search}%`)
      )
    );
  }

  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      description: meetings.description,
      startTime: meetings.startTime,
      endTime: meetings.endTime,
      meetingUrl: meetings.meetingUrl,
      attendeeName: meetings.attendeeName,
      attendeeEmail: meetings.attendeeEmail,
      attendeeTimezone: meetings.attendeeTimezone,
      organizerName: meetings.organizerName,
      organizerEmail: meetings.organizerEmail,
      status: meetings.status,
      source: meetings.source,
      clientId: meetings.clientId,
      leadId: meetings.leadId,
      projectId: meetings.projectId,
      calcomBookingUid: meetings.calcomBookingUid,
      metadata: meetings.metadata,
      createdAt: meetings.createdAt,
      leadName: leads.fullName,
      leadPipelineStage: leads.pipelineStage,
      clientName: clients.fullName,
    })
    .from(meetings)
    .leftJoin(leads, eq(meetings.leadId, leads.id))
    .leftJoin(clients, eq(meetings.clientId, clients.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(meetings.startTime))
    .limit(limit)
    .offset(offset);

  return rows;
}

/**
 * Get meetings for a specific client (for client detail Meetings tab).
 */
export async function getMeetingsByClientId(clientId) {
  const isDemo = await isDemoMode();
  return db
    .select({
      id: meetings.id,
      title: meetings.title,
      startTime: meetings.startTime,
      endTime: meetings.endTime,
      meetingUrl: meetings.meetingUrl,
      attendeeName: meetings.attendeeName,
      attendeeEmail: meetings.attendeeEmail,
      status: meetings.status,
      source: meetings.source,
      calcomBookingUid: meetings.calcomBookingUid,
    })
    .from(meetings)
    .where(and(eq(meetings.clientId, clientId), eq(meetings.isDemo, isDemo)))
    .orderBy(desc(meetings.startTime));
}

/**
 * Get today's meetings (for dashboard schedule widget).
 */
export async function getTodaysMeetings() {
  const isDemo = await isDemoMode();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000);

  return db
    .select({
      id: meetings.id,
      title: meetings.title,
      startTime: meetings.startTime,
      endTime: meetings.endTime,
      meetingUrl: meetings.meetingUrl,
      attendeeName: meetings.attendeeName,
      attendeeEmail: meetings.attendeeEmail,
      status: meetings.status,
      source: meetings.source,
      leadId: meetings.leadId,
      clientId: meetings.clientId,
    })
    .from(meetings)
    .where(
      and(
        gte(meetings.startTime, startOfDay),
        lte(meetings.startTime, endOfDay),
        or(eq(meetings.status, 'scheduled'), eq(meetings.status, 'rescheduled')),
        eq(meetings.isDemo, isDemo)
      )
    )
    .orderBy(asc(meetings.startTime));
}
