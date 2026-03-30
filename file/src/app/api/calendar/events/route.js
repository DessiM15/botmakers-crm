import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import { getMeetingsForRange } from '@/lib/db/queries/meetings';
import { getCalendarEventsForRange, deduplicateEvents } from '@/lib/db/queries/calendar-events';
import { db } from '@/lib/db/client';
import { projectMilestones, projects } from '@/lib/db/schema';
import { and, gte, lte, ne, eq } from 'drizzle-orm';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end params required' }, { status: 400 });
    }

    const events = [];
    let meetingsList = [];

    // Fetch meetings
    try {
      meetingsList = await getMeetingsForRange(start, end);
      for (const m of meetingsList) {
        const isCancelled = m.status === 'cancelled';
        const isCalcom = m.source === 'calcom';
        events.push({
          id: `meeting-${m.id}`,
          title: m.title,
          start: m.startTime,
          end: m.endTime,
          extendedProps: {
            type: 'meeting',
            category: isCalcom ? 'calcom' : 'meeting',
            isCancelled,
            meetingId: m.id,
            status: m.status,
            meetingUrl: m.meetingUrl,
            attendeeName: m.attendeeName,
            attendeeEmail: m.attendeeEmail,
            source: m.source,
          },
        });
      }
    } catch {
      // meetings table query failed — continue without meetings
    }

    // Fetch website bookings from calendar_events
    try {
      const calEvents = await getCalendarEventsForRange(start, end);
      const uniqueCalEvents = deduplicateEvents(meetingsList, calEvents);

      for (const ce of uniqueCalEvents) {
        events.push({
          id: `website-${ce.id}`,
          title: ce.title,
          start: ce.startTime,
          end: ce.endTime,
          extendedProps: {
            type: 'meeting',
            category: 'website',
            isCancelled: ce.status === 'cancelled',
            meetingId: ce.id,
            status: ce.status,
            meetingUrl: ce.meetingUrl,
            attendeeName: ce.attendeeName,
            attendeeEmail: ce.attendeeEmail,
            source: 'website',
            _isCalendarEvent: true,
          },
        });
      }
    } catch {
      // calendar_events table may not exist — continue without website bookings
    }

    // Fetch milestones with due dates in range
    try {
      const milestones = await db
        .select({
          id: projectMilestones.id,
          title: projectMilestones.title,
          dueDate: projectMilestones.dueDate,
          status: projectMilestones.status,
          projectId: projectMilestones.projectId,
          projectName: projects.name,
        })
        .from(projectMilestones)
        .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
        .where(
          and(
            gte(projectMilestones.dueDate, start),
            lte(projectMilestones.dueDate, end),
            ne(projectMilestones.status, 'completed')
          )
        );

      for (const ms of milestones) {
        const isOverdue = new Date(ms.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
        events.push({
          id: `milestone-${ms.id}`,
          title: ms.title,
          start: ms.dueDate,
          allDay: true,
          extendedProps: {
            type: 'milestone',
            category: 'milestone',
            isOverdue,
            milestoneId: ms.id,
            projectId: ms.projectId,
            projectName: ms.projectName,
            status: ms.status,
          },
        });
      }
    } catch {
      // milestones query failed — continue without milestones
    }

    return NextResponse.json(events);
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
