-- 0012_calendar_events.sql
-- Create calendar_events table for Google Calendar sync

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  meeting_link TEXT,
  attendees JSONB,
  event_type TEXT NOT NULL DEFAULT 'other',
  related_lead_id UUID,
  related_client_id UUID,
  related_project_id UUID,
  booked_by_name TEXT,
  booked_by_email TEXT,
  booked_by_phone TEXT,
  booked_by_company TEXT,
  google_html_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index for upsert on google_event_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_google_event_id
  ON calendar_events (google_event_id)
  WHERE google_event_id IS NOT NULL;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events (start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_booked_by_email ON calendar_events (booked_by_email);
CREATE INDEX IF NOT EXISTS idx_calendar_events_related_lead ON calendar_events (related_lead_id) WHERE related_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_related_client ON calendar_events (related_client_id) WHERE related_client_id IS NOT NULL;
