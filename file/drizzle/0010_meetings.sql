-- Migration: Add meetings table for Cal.com + manual meetings

DO $$ BEGIN
  CREATE TYPE meeting_source AS ENUM ('cal_com', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE meeting_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  meeting_url TEXT,
  attendee_name TEXT,
  attendee_email TEXT,
  client_id UUID REFERENCES clients(id),
  lead_id UUID REFERENCES leads(id),
  project_id UUID REFERENCES projects(id),
  calcom_booking_uid TEXT UNIQUE,
  source meeting_source NOT NULL DEFAULT 'manual',
  status meeting_status NOT NULL DEFAULT 'scheduled',
  created_by UUID REFERENCES team_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_calcom_uid ON meetings(calcom_booking_uid);
