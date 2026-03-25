import { google } from 'googleapis';
import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function test() {
  const users = await sql`SELECT id, full_name, google_refresh_token, google_calendar_email FROM team_users WHERE google_calendar_connected = true`;
  console.log('Connected users:', users.length);

  if (users.length === 0) {
    console.log('No connected users found');
    await sql.end();
    return;
  }

  const user = users[0];
  console.log('User:', user.full_name, user.google_calendar_email);
  console.log('Has refresh token:', Boolean(user.google_refresh_token));

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: user.google_refresh_token });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const now = new Date();
  const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  console.log('Fetching events from', timeMin, 'to', timeMax);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  });

  const events = res.data.items || [];
  console.log('Events found:', events.length);

  for (const e of events.slice(0, 5)) {
    console.log(' -', e.summary, '|', e.start?.dateTime || e.start?.date);
  }
  if (events.length > 5) console.log('  ... and', events.length - 5, 'more');

  let synced = 0;
  for (const event of events) {
    const googleEventId = event.id;
    if (!googleEventId) continue;

    const startTime = event.start?.dateTime || event.start?.date;
    const endTime = event.end?.dateTime || event.end?.date;
    if (!startTime || !endTime) continue;

    const attendees = event.attendees?.map(a => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus,
      organizer: a.organizer || false,
    })) || [];

    const externalAttendee = attendees.find(a => !a.organizer && a.email !== user.google_calendar_email);

    let meetingLink = null;
    if (event.conferenceData?.entryPoints) {
      const v = event.conferenceData.entryPoints.find(e => e.entryPointType === 'video');
      meetingLink = v?.uri || null;
    }
    if (!meetingLink && event.hangoutLink) meetingLink = event.hangoutLink;

    let eventType = 'other';
    const titleLower = (event.summary || '').toLowerCase();
    if (titleLower.includes('discovery') || titleLower.includes('consultation') || titleLower.includes('intro')) eventType = 'discovery';
    else if (titleLower.includes('demo')) eventType = 'demo';
    else if (attendees.length > 0) eventType = 'meeting';

    try {
      await sql`
        INSERT INTO calendar_events (
          google_event_id, title, description, start_time, end_time,
          location, meeting_link, attendees, event_type,
          booked_by_name, booked_by_email,
          google_html_link, updated_at
        ) VALUES (
          ${googleEventId}, ${event.summary || 'Untitled'}, ${event.description || null},
          ${new Date(startTime)}, ${new Date(endTime)},
          ${event.location || null}, ${meetingLink},
          ${attendees.length > 0 ? JSON.stringify(attendees) : null}::jsonb,
          ${eventType},
          ${externalAttendee?.displayName || null}, ${externalAttendee?.email || null},
          ${event.htmlLink || null}, NOW()
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
          booked_by_name = EXCLUDED.booked_by_name,
          booked_by_email = EXCLUDED.booked_by_email,
          google_html_link = EXCLUDED.google_html_link,
          updated_at = NOW()
      `;
      synced++;
    } catch (err) {
      console.error('Failed to upsert:', googleEventId, err.message);
    }
  }

  console.log('Synced', synced, 'events to database');

  const [count] = await sql`SELECT COUNT(*) as cnt FROM calendar_events`;
  console.log('Total calendar_events in DB:', count.cnt);

  await sql.end();
  console.log('Done!');
}

test().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
