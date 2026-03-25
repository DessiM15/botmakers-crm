/**
 * Shared Google Calendar sync logic.
 * Called from both the server action (calendar.js) and cron route (sync-calendar).
 * NOT a server action — no 'use server'.
 */

import { db } from '@/lib/db/client';
import { teamUsers, calendarEvents, leads, clients, activityLog } from '@/lib/db/schema';
import { sql, eq, and } from 'drizzle-orm';
import { listGoogleCalendarEvents } from '@/lib/integrations/google-calendar';
import { sendUserNotification } from '@/lib/notifications/notify';

/**
 * Sync Google Calendar events for all connected team members.
 *
 * @returns {{ synced: number, errors: Array, disconnectedUsers: string[] }}
 */
export async function syncAllCalendars() {
  // Find all connected team members
  const connectedUsers = await db
    .select({
      id: teamUsers.id,
      fullName: teamUsers.fullName,
      googleRefreshToken: teamUsers.googleRefreshToken,
      googleCalendarEmail: teamUsers.googleCalendarEmail,
    })
    .from(teamUsers)
    .where(
      and(
        eq(teamUsers.googleCalendarConnected, true),
        eq(teamUsers.isActive, true)
      )
    );

  if (connectedUsers.length === 0) {
    return { synced: 0, errors: [], disconnectedUsers: [], users: 0 };
  }

  // Time range: 7 days back to 30 days ahead
  const now = new Date();
  const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Pre-fetch leads and clients for email matching
  const [allLeads, allClients] = await Promise.all([
    db.select({ id: leads.id, email: leads.email }).from(leads),
    db.select({ id: clients.id, email: clients.email }).from(clients),
  ]);

  const leadsByEmail = new Map(allLeads.map((l) => [l.email.toLowerCase(), l.id]));
  const clientsByEmail = new Map(allClients.map((c) => [c.email.toLowerCase(), c.id]));

  const seenEventIds = new Set();
  const eventsToUpsert = [];
  const errors = [];
  const disconnectedUsers = [];

  for (const user of connectedUsers) {
    try {
      const events = await listGoogleCalendarEvents(user.googleRefreshToken, timeMin, timeMax);

      for (const event of events) {
        const googleEventId = event.id;
        if (!googleEventId || seenEventIds.has(googleEventId)) continue;
        seenEventIds.add(googleEventId);

        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;
        if (!startTime || !endTime) continue;

        const attendees = event.attendees?.map((a) => ({
          email: a.email,
          displayName: a.displayName,
          responseStatus: a.responseStatus,
          organizer: a.organizer || false,
        })) || [];

        const externalAttendee = attendees.find(
          (a) => !a.organizer && a.email !== user.googleCalendarEmail
        );
        const bookedByEmail = externalAttendee?.email || null;
        const bookedByName = externalAttendee?.displayName || null;

        let relatedLeadId = null;
        let relatedClientId = null;
        if (bookedByEmail) {
          const emailLower = bookedByEmail.toLowerCase();
          relatedClientId = clientsByEmail.get(emailLower) || null;
          if (!relatedClientId) {
            relatedLeadId = leadsByEmail.get(emailLower) || null;
          }
        }

        let meetingLink = null;
        if (event.conferenceData?.entryPoints) {
          const videoEntry = event.conferenceData.entryPoints.find((e) => e.entryPointType === 'video');
          meetingLink = videoEntry?.uri || null;
        }
        if (!meetingLink && event.hangoutLink) {
          meetingLink = event.hangoutLink;
        }

        let eventType = 'other';
        const titleLower = (event.summary || '').toLowerCase();
        if (titleLower.includes('discovery') || titleLower.includes('consultation') || titleLower.includes('intro')) {
          eventType = 'discovery';
        } else if (titleLower.includes('demo')) {
          eventType = 'demo';
        } else if (titleLower.includes('follow') || titleLower.includes('check-in') || titleLower.includes('checkin')) {
          eventType = 'follow_up';
        } else if (titleLower.includes('kickoff') || titleLower.includes('kick-off')) {
          eventType = 'kickoff';
        } else if (attendees.length > 0) {
          eventType = 'meeting';
        }

        eventsToUpsert.push({
          googleEventId,
          title: event.summary || 'Untitled Event',
          description: event.description || null,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          location: event.location || null,
          meetingLink,
          attendees: attendees.length > 0 ? attendees : null,
          eventType,
          relatedLeadId,
          relatedClientId,
          bookedByName,
          bookedByEmail,
          googleHtmlLink: event.htmlLink || null,
        });
      }
    } catch (err) {
      if (err.code === 401 || err.message?.includes('invalid_grant') || err.response?.status === 401) {
        // Token expired — auto-disconnect and notify
        await db
          .update(teamUsers)
          .set({
            googleRefreshToken: null,
            googleCalendarConnected: false,
            googleCalendarEmail: null,
            updatedAt: new Date(),
          })
          .where(eq(teamUsers.id, user.id));

        disconnectedUsers.push(user.fullName);

        // Notify the affected user
        sendUserNotification({
          userId: user.id,
          type: 'meeting_reminder',
          title: 'Google Calendar disconnected',
          body: 'Your Google Calendar token expired. Please reconnect in Settings.',
          link: '/settings',
        }).catch(() => {});

        errors.push({ userId: user.id, error: 'Token expired — auto-disconnected' });
      } else {
        errors.push({ userId: user.id, error: err.message || 'Unknown error' });
      }
    }
  }

  // Upsert events
  let synced = 0;
  for (const event of eventsToUpsert) {
    try {
      await db.execute(sql`
        INSERT INTO calendar_events (
          google_event_id, title, description, start_time, end_time,
          location, meeting_link, attendees, event_type,
          related_lead_id, related_client_id,
          booked_by_name, booked_by_email,
          google_html_link, updated_at
        ) VALUES (
          ${event.googleEventId}, ${event.title}, ${event.description},
          ${event.startTime}, ${event.endTime},
          ${event.location}, ${event.meetingLink},
          ${event.attendees ? JSON.stringify(event.attendees) : null}::jsonb,
          ${event.eventType},
          ${event.relatedLeadId}, ${event.relatedClientId},
          ${event.bookedByName}, ${event.bookedByEmail},
          ${event.googleHtmlLink}, NOW()
        )
        ON CONFLICT (google_event_id) WHERE google_event_id IS NOT NULL
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          location = EXCLUDED.location,
          meeting_link = EXCLUDED.meeting_link,
          attendees = EXCLUDED.attendees,
          event_type = EXCLUDED.event_type,
          related_lead_id = EXCLUDED.related_lead_id,
          related_client_id = EXCLUDED.related_client_id,
          booked_by_name = EXCLUDED.booked_by_name,
          booked_by_email = EXCLUDED.booked_by_email,
          google_html_link = EXCLUDED.google_html_link,
          updated_at = NOW()
      `);
      synced++;
    } catch (err) {
      errors.push({ googleEventId: event.googleEventId, error: err.message });
    }
  }

  // Log activity
  if (synced > 0) {
    await db.insert(activityLog).values({
      actorType: 'system',
      action: 'calendar.synced',
      entityType: 'calendar_event',
      entityId: '00000000-0000-0000-0000-000000000000',
      metadata: { synced, errors: errors.length, users: connectedUsers.length },
    });
  }

  return { synced, errors, disconnectedUsers, users: connectedUsers.length };
}
