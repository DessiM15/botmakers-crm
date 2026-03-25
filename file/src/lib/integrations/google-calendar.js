/**
 * Google Calendar integration — lazy imports to avoid ERR_INVALID_PACKAGE_CONFIG
 * from google-logging-utils transitive dependency at build time.
 */

export function isGoogleCalendarConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}

async function getGoogle() {
  const { google } = await import('googleapis');
  return google;
}

async function getOAuth2Client() {
  const google = await getGoogle();
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export async function getGoogleAuthUrl(stateUserId) {
  const oauth2Client = await getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    state: stateUserId,
  });
}

export async function exchangeCodeForTokens(code) {
  const oauth2Client = await getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getGoogleUserEmail(refreshToken) {
  const google = await getGoogle();
  const oauth2Client = await getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data.email;
}

export async function listGoogleCalendarEvents(refreshToken, { timeMin, timeMax } = {}) {
  const google = await getGoogle();
  const oauth2Client = await getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const now = new Date();
  const params = {
    calendarId: 'primary',
    timeMin: timeMin || now.toISOString(),
    timeMax: timeMax || new Date(now.getTime() + 30 * 86400000).toISOString(),
    maxResults: 100,
    singleEvents: true,
    orderBy: 'startTime',
  };

  const { data } = await calendar.events.list(params);
  return (data.items || []).map((event) => ({
    googleEventId: event.id,
    title: event.summary || 'Untitled',
    description: event.description || null,
    startTime: event.start?.dateTime || event.start?.date,
    endTime: event.end?.dateTime || event.end?.date,
    meetingLink: event.hangoutLink || null,
    googleHtmlLink: event.htmlLink || null,
    attendees: (event.attendees || []).map((a) => ({
      email: a.email,
      name: a.displayName || null,
      responseStatus: a.responseStatus,
    })),
  }));
}
