import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, createAdminClient } from '@/lib/db/client';
import { meetings, clients, leads, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendTeamNotification } from '@/lib/notifications/notify';
import { meetingBookedAlert } from '@/lib/email/notifications';
import { convertLeadToClientInternal } from '@/lib/actions/clients';
import { sendEmail } from '@/lib/email/client';
import { welcomeClient } from '@/lib/email/templates';

/**
 * Verify Cal.com webhook signature (HMAC-SHA256).
 */
function verifySignature(payload, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

const DEFAULT_MEETING_URL = 'https://meetings.dialpad.com/aicallers';

/**
 * Extract meeting URL from Cal.com payload, falling back to default Dialpad link.
 */
function extractMeetingUrl(payload) {
  if (typeof payload.location === 'string' && payload.location.startsWith('http')) {
    return payload.location;
  }
  if (payload.metadata && typeof payload.metadata.videoCallUrl === 'string') {
    return payload.metadata.videoCallUrl;
  }
  return DEFAULT_MEETING_URL;
}

export async function POST(request) {
  try {
    const secret = process.env.CAL_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'CAL_WEBHOOK_SECRET not configured' },
        { status: 503 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('x-cal-signature-256');

    if (!verifySignature(body, signature, secret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);
    const triggerEvent = event.triggerEvent;
    const payload = event.payload || {};

    // ── BOOKING_CREATED ──
    if (triggerEvent === 'BOOKING_CREATED') {
      const uid = payload.uid;
      if (!uid) {
        return NextResponse.json({ ok: true, message: 'No booking UID' });
      }

      // Dedup: check if already exists
      const [existing] = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(eq(meetings.calcomBookingUid, uid))
        .limit(1);

      if (existing) {
        return NextResponse.json({ ok: true, message: 'Booking already exists' });
      }

      const attendee = payload.attendees?.[0];
      const attendeeEmail = attendee?.email || null;
      const attendeeName = attendee?.name || null;
      const attendeeTimezone = attendee?.timeZone || null;
      const organizerName = payload.organizer?.name || null;
      const organizerEmail = payload.organizer?.email || null;

      // Try to match attendee to existing client or lead
      let clientId = null;
      let leadId = null;
      let matchedLead = null;

      if (attendeeEmail) {
        const [client] = await db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.email, attendeeEmail.toLowerCase()))
          .limit(1);

        if (client) {
          clientId = client.id;
        } else {
          const [lead] = await db
            .select()
            .from(leads)
            .where(eq(leads.email, attendeeEmail.toLowerCase()))
            .limit(1);

          if (lead) {
            leadId = lead.id;
            matchedLead = lead;

            // Convert lead to client
            const convResult = await convertLeadToClientInternal(lead, null, 'system');
            if (convResult.success) {
              clientId = convResult.clientId;
            }
          } else {
            // No client or lead found — create a new client directly
            const [newClient] = await db
              .insert(clients)
              .values({
                fullName: attendeeName || attendeeEmail.split('@')[0],
                email: attendeeEmail.toLowerCase(),
                createdBy: null,
              })
              .returning();

            clientId = newClient.id;

            // Create Supabase Auth account for portal access
            const adminClient = createAdminClient();
            const { data: authData, error: authError } =
              await adminClient.auth.admin.createUser({
                email: attendeeEmail.toLowerCase(),
                email_confirm: true,
                user_metadata: {
                  full_name: attendeeName || attendeeEmail.split('@')[0],
                  role: 'client',
                },
              });

            if (authError) {
              if (authError.message?.includes('already been registered')) {
                const { data: listData } = await adminClient.auth.admin.listUsers();
                const existingAuthUser = listData?.users?.find(
                  (u) => u.email === attendeeEmail.toLowerCase()
                );
                if (existingAuthUser) {
                  await db
                    .update(clients)
                    .set({ authUserId: existingAuthUser.id })
                    .where(eq(clients.id, newClient.id));
                }
              }
            } else if (authData?.user) {
              await db
                .update(clients)
                .set({ authUserId: authData.user.id })
                .where(eq(clients.id, newClient.id));
            }

            // Log client creation
            await db.insert(activityLog).values({
              actorType: 'system',
              action: 'client.created',
              entityType: 'client',
              entityId: newClient.id,
              metadata: { name: newClient.fullName, source: 'cal_com_booking' },
            });

            // Send welcome email (don't block on failure)
            const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/portal/login`;
            sendEmail({
              to: attendeeEmail,
              subject: 'Welcome to Your Botmakers Client Portal',
              html: welcomeClient(newClient.fullName, portalUrl),
            }).catch(() => {});
          }
        }
      }

      const startTime = payload.startTime ? new Date(payload.startTime) : new Date();
      const endTime = payload.endTime ? new Date(payload.endTime) : new Date(startTime.getTime() + 30 * 60 * 1000);
      const meetingUrl = extractMeetingUrl(payload);

      const [meeting] = await db
        .insert(meetings)
        .values({
          title: payload.title || 'Cal.com Meeting',
          description: payload.description || null,
          startTime,
          endTime,
          meetingUrl,
          attendeeName,
          attendeeEmail,
          attendeeTimezone,
          organizerName,
          organizerEmail,
          clientId,
          leadId,
          calcomBookingUid: uid,
          source: 'cal_com',
          status: 'scheduled',
          metadata: payload,
        })
        .returning();

      // Auto-advance early-stage leads to discovery_scheduled
      if (matchedLead && ['new_lead', 'contacted'].includes(matchedLead.pipelineStage)) {
        await db
          .update(leads)
          .set({
            pipelineStage: 'discovery_scheduled',
            pipelineStageChangedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(leads.id, matchedLead.id));
      }

      await db.insert(activityLog).values({
        actorType: 'system',
        action: 'meeting.booked_via_cal',
        entityType: 'meeting',
        entityId: meeting.id,
        metadata: {
          title: meeting.title,
          attendeeName,
          attendeeEmail,
          calcomUid: uid,
          matchedLeadId: matchedLead?.id || null,
        },
      });

      // Send branded email alert to team
      meetingBookedAlert({
        attendeeName: attendeeName || 'Unknown',
        attendeeEmail: attendeeEmail || 'N/A',
        title: meeting.title,
        startTime: payload.startTime || startTime.toISOString(),
        endTime: payload.endTime || endTime.toISOString(),
        meetingUrl,
        matchedLeadName: matchedLead?.fullName || null,
        matchedLeadId: matchedLead?.id || null,
      }).catch(() => {});

      // Send in-app notification
      sendTeamNotification({
        type: 'meeting_booked',
        title: `New meeting booked: ${meeting.title}`,
        body: attendeeName
          ? `${attendeeName} (${attendeeEmail || 'no email'}) booked a meeting`
          : 'A new meeting was booked via Cal.com',
        link: '/meetings',
      }).catch(() => {});

      return NextResponse.json({
        ok: true,
        message: 'Booking created',
        meetingId: meeting.id,
      });
    }

    // ── BOOKING_RESCHEDULED ──
    if (triggerEvent === 'BOOKING_RESCHEDULED') {
      const uid = payload.uid || payload.rescheduleUid;
      if (!uid) {
        return NextResponse.json({ ok: true, message: 'No booking UID' });
      }

      const [existing] = await db
        .select({ id: meetings.id, meetingUrl: meetings.meetingUrl })
        .from(meetings)
        .where(eq(meetings.calcomBookingUid, uid))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ ok: true, message: 'Booking not found' });
      }

      const startTime = payload.startTime ? new Date(payload.startTime) : undefined;
      const endTime = payload.endTime ? new Date(payload.endTime) : undefined;
      const meetingUrl = extractMeetingUrl(payload);

      const updates = { status: 'rescheduled', updatedAt: new Date(), metadata: payload };
      if (startTime) updates.startTime = startTime;
      if (endTime) updates.endTime = endTime;
      if (meetingUrl) updates.meetingUrl = meetingUrl;

      await db
        .update(meetings)
        .set(updates)
        .where(eq(meetings.calcomBookingUid, uid));

      await db.insert(activityLog).values({
        actorType: 'system',
        action: 'meeting.rescheduled',
        entityType: 'meeting',
        entityId: existing.id,
        metadata: {
          newStartTime: payload.startTime,
          newEndTime: payload.endTime,
        },
      }).catch(() => {});

      // Team in-app notification (non-blocking)
      const reschAttendee = payload.attendees?.[0];
      sendTeamNotification({
        type: 'meeting_rescheduled',
        title: 'Meeting rescheduled',
        body: `${reschAttendee?.name || 'Someone'} rescheduled${startTime ? ` — new time: ${startTime.toLocaleString()}` : ''}`,
        link: '/calendar',
      }).catch(() => {});

      return NextResponse.json({ ok: true, message: 'Booking rescheduled' });
    }

    // ── BOOKING_CANCELLED ──
    if (triggerEvent === 'BOOKING_CANCELLED') {
      const uid = payload.uid;
      if (!uid) {
        return NextResponse.json({ ok: true, message: 'No booking UID' });
      }

      const [existing] = await db
        .select({ id: meetings.id, attendeeEmail: meetings.attendeeEmail, title: meetings.title })
        .from(meetings)
        .where(eq(meetings.calcomBookingUid, uid))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ ok: true, message: 'Booking not found' });
      }

      await db
        .update(meetings)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(meetings.calcomBookingUid, uid));

      await db.insert(activityLog).values({
        actorType: 'system',
        action: 'meeting.cancelled',
        entityType: 'meeting',
        entityId: existing.id,
        metadata: {
          attendeeEmail: existing.attendeeEmail,
          title: existing.title,
        },
      }).catch(() => {});

      // Team in-app notification (non-blocking)
      sendTeamNotification({
        type: 'meeting_cancelled',
        title: `Booking cancelled: ${existing.title}`,
        body: `${existing.attendeeEmail || 'Unknown attendee'} cancelled`,
        link: '/calendar',
      }).catch(() => {});

      return NextResponse.json({ ok: true, message: 'Booking cancelled' });
    }

    return NextResponse.json({ ok: true, message: `Unhandled event: ${triggerEvent}` });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('[CB-INT-006] Cal.com webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
