-- 0013_team_users_google_calendar.sql
-- Add Google Calendar OAuth columns to team_users

ALTER TABLE team_users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE team_users ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE team_users ADD COLUMN IF NOT EXISTS google_calendar_email TEXT;
