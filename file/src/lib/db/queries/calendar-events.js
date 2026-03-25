import { db } from '@/lib/db/client';
import { calendarEvents, leads, clients } from '@/lib/db/schema';
import { and, gte, lte, or, asc, desc, ilike, eq } from 'drizzle-orm';

/**
 * Normalize a calendar_events row to match the meetings query shape.
 */
export function normalizeCalendarEvent(row) {
  const now = new Date();
  const endTime = new Date(row.endTime);
  const inferredStatus = endTime < now ? 'completed' : 'scheduled';

  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    startTime: row.startTime,
    endTime: row.endTime,
    meetingUrl: row.meetingLink || row.googleHtmlLink || null,
    attendeeName: row.bookedByName || null,
    attendeeEmail: row.bookedByEmail || null,
    attendeeTimezone: null,
    organizerName: null,
    organizerEmail: null,
    status: inferredStatus,
    source: 'website',
    clientId: row.relatedClientId || null,
    leadId: row.relatedLeadId || null,
    projectId: row.relatedProjectId || null,
    calcomBookingUid: null,
    metadata: null,
    createdAt: row.createdAt,
    eventType: row.eventType,
    googleHtmlLink: row.googleHtmlLink || null,
    leadName: row.leadName || null,
    leadPipelineStage: row.leadPipelineStage || null,
    clientName: row.clientName || null,
    _isCalendarEvent: true,
  };
}

/**
 * Deduplicate: remove calendar_events that overlap with existing meetings
 * (same attendee email + start times within 5 minutes).
 */
export function deduplicateEvents(meetingsArr, calendarEventsArr) {
  const meetingKeys = new Set();
  for (const m of meetingsArr) {
    if (m.attendeeEmail) {
      const startMs = new Date(m.startTime).getTime();
      meetingKeys.add(`${m.attendeeEmail.toLowerCase()}|${Math.round(startMs / 300000)}`);
    }
  }

  return calendarEventsArr.filter((ce) => {
    if (!ce.attendeeEmail) return true;
    const startMs = new Date(ce.startTime).getTime();
    const key = `${ce.attendeeEmail.toLowerCase()}|${Math.round(startMs / 300000)}`;
    return !meetingKeys.has(key);
  });
}

/**
 * Get calendar_events for a date range (for FullCalendar).
 */
export async function getCalendarEventsForRange(start, end) {
  const rows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      description: calendarEvents.description,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      meetingLink: calendarEvents.meetingLink,
      bookedByName: calendarEvents.bookedByName,
      bookedByEmail: calendarEvents.bookedByEmail,
      eventType: calendarEvents.eventType,
      relatedClientId: calendarEvents.relatedClientId,
      relatedLeadId: calendarEvents.relatedLeadId,
      relatedProjectId: calendarEvents.relatedProjectId,
      googleHtmlLink: calendarEvents.googleHtmlLink,
      createdAt: calendarEvents.createdAt,
    })
    .from(calendarEvents)
    .where(
      and(
        gte(calendarEvents.startTime, new Date(start)),
        lte(calendarEvents.endTime, new Date(end))
      )
    )
    .orderBy(asc(calendarEvents.startTime));

  return rows.map(normalizeCalendarEvent);
}

/**
 * Get calendar_events for a specific date (for dashboard TodaySchedule).
 */
export async function getCalendarEventsForDate(date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const rows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      meetingLink: calendarEvents.meetingLink,
      bookedByName: calendarEvents.bookedByName,
      bookedByEmail: calendarEvents.bookedByEmail,
      eventType: calendarEvents.eventType,
      relatedClientId: calendarEvents.relatedClientId,
      relatedLeadId: calendarEvents.relatedLeadId,
      googleHtmlLink: calendarEvents.googleHtmlLink,
      createdAt: calendarEvents.createdAt,
    })
    .from(calendarEvents)
    .where(
      and(
        gte(calendarEvents.startTime, dayStart),
        lte(calendarEvents.startTime, dayEnd)
      )
    )
    .orderBy(asc(calendarEvents.startTime));

  return rows.map(normalizeCalendarEvent);
}

/**
 * Get calendar_events for a specific client.
 */
export async function getCalendarEventsByClientId(clientId) {
  const rows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      meetingLink: calendarEvents.meetingLink,
      bookedByName: calendarEvents.bookedByName,
      bookedByEmail: calendarEvents.bookedByEmail,
      eventType: calendarEvents.eventType,
      relatedClientId: calendarEvents.relatedClientId,
      relatedLeadId: calendarEvents.relatedLeadId,
      googleHtmlLink: calendarEvents.googleHtmlLink,
      createdAt: calendarEvents.createdAt,
    })
    .from(calendarEvents)
    .where(eq(calendarEvents.relatedClientId, clientId))
    .orderBy(desc(calendarEvents.startTime));

  return rows.map(normalizeCalendarEvent);
}

/**
 * Get paginated calendar_events with optional search (for meetings list).
 */
export async function getCalendarEventsList({ search, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(calendarEvents.title, `%${search}%`),
        ilike(calendarEvents.bookedByName, `%${search}%`),
        ilike(calendarEvents.bookedByEmail, `%${search}%`)
      )
    );
  }

  const rows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      description: calendarEvents.description,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      meetingLink: calendarEvents.meetingLink,
      bookedByName: calendarEvents.bookedByName,
      bookedByEmail: calendarEvents.bookedByEmail,
      eventType: calendarEvents.eventType,
      relatedClientId: calendarEvents.relatedClientId,
      relatedLeadId: calendarEvents.relatedLeadId,
      relatedProjectId: calendarEvents.relatedProjectId,
      googleHtmlLink: calendarEvents.googleHtmlLink,
      createdAt: calendarEvents.createdAt,
      leadName: leads.fullName,
      leadPipelineStage: leads.pipelineStage,
      clientName: clients.fullName,
    })
    .from(calendarEvents)
    .leftJoin(leads, eq(calendarEvents.relatedLeadId, leads.id))
    .leftJoin(clients, eq(calendarEvents.relatedClientId, clients.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(calendarEvents.startTime))
    .limit(limit)
    .offset(offset);

  return rows.map(normalizeCalendarEvent);
}
