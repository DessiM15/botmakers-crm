'use server';

import { db } from '@/lib/db/client';
import { meetings, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { sendTeamNotification } from '@/lib/notifications/notify';
import { meetingCreatedAlert, meetingCancelledAttendeeEmail } from '@/lib/email/notifications';

/**
 * Create a new meeting (manual).
 */
export async function createMeeting(data) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    if (!data.title?.trim()) {
      return { error: 'CB-API-001: Title is required' };
    }
    if (!data.startTime || !data.endTime) {
      return { error: 'CB-API-001: Start and end time are required' };
    }

    const [meeting] = await db
      .insert(meetings)
      .values({
        title: data.title.trim(),
        description: data.description?.trim() || null,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        meetingUrl: data.meetingUrl?.trim() || null,
        attendeeName: data.attendeeName?.trim() || null,
        attendeeEmail: data.attendeeEmail?.trim() || null,
        clientId: data.clientId || null,
        leadId: data.leadId || null,
        projectId: data.projectId || null,
        source: 'manual',
        status: 'scheduled',
        createdBy: teamUser.id,
      })
      .returning();

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'meeting.created',
      entityType: 'meeting',
      entityId: meeting.id,
      metadata: { title: meeting.title },
    });

    // Team notification (non-blocking)
    sendTeamNotification({
      type: 'meeting_created',
      title: `Meeting created: ${meeting.title}`,
      body: `${teamUser.fullName} scheduled "${meeting.title}"${data.attendeeName ? ` with ${data.attendeeName}` : ''}.`,
      link: '/calendar',
      excludeUserId: teamUser.id,
    }).catch(() => {});

    // Team email notification (non-blocking)
    meetingCreatedAlert({
      title: meeting.title,
      attendeeName: data.attendeeName || null,
      attendeeEmail: data.attendeeEmail || null,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      meetingUrl: data.meetingUrl || null,
      creatorName: teamUser.fullName,
    }).catch(() => {});

    revalidatePath('/');
    revalidatePath('/calendar');

    return { success: true, meeting };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to create meeting' };
  }
}

/**
 * Update a meeting's status (complete, no-show, cancel).
 */
export async function updateMeetingStatus(meetingId, newStatus) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const validStatuses = ['scheduled', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(newStatus)) {
      return { error: 'CB-API-001: Invalid status' };
    }

    const [existing] = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        attendeeName: meetings.attendeeName,
        attendeeEmail: meetings.attendeeEmail,
        startTime: meetings.startTime,
        status: meetings.status,
      })
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);

    if (!existing) {
      return { error: 'CB-DB-002: Meeting not found' };
    }

    await db
      .update(meetings)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(meetings.id, meetingId));

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: `meeting.${newStatus}`,
      entityType: 'meeting',
      entityId: meetingId,
      metadata: { title: existing.title },
    });

    // Team in-app notification (non-blocking)
    const statusLabels = { completed: 'completed', cancelled: 'cancelled', no_show: 'marked no-show' };
    const label = statusLabels[newStatus] || newStatus;
    sendTeamNotification({
      type: `meeting_${newStatus}`,
      title: `Meeting ${label}: ${existing.title}`,
      body: `${teamUser.fullName} ${label} "${existing.title}".`,
      link: '/calendar',
      excludeUserId: teamUser.id,
    }).catch(() => {});

    // Send attendee email when cancelling
    if (newStatus === 'cancelled' && existing.attendeeEmail) {
      meetingCancelledAttendeeEmail(
        existing.attendeeEmail,
        existing.attendeeName,
        existing.title,
        existing.startTime
      ).catch(() => {});
    }

    revalidatePath('/');
    revalidatePath('/calendar');

    return { success: true };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to update meeting' };
  }
}

/**
 * Cancel a meeting.
 */
export async function cancelMeeting(meetingId) {
  return updateMeetingStatus(meetingId, 'cancelled');
}

/**
 * Mark meeting as completed.
 */
export async function completeMeeting(meetingId) {
  return updateMeetingStatus(meetingId, 'completed');
}
