-- Migration: Enhance meetings table for Cal.com integration
-- Adds organizer info, attendee timezone, metadata, and rescheduled status

-- Add 'rescheduled' to meeting_status enum
ALTER TYPE meeting_status ADD VALUE IF NOT EXISTS 'rescheduled';

-- Add 'meeting_booked' to notification_type enum
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_booked';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS attendee_timezone TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS organizer_name TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS organizer_email TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Index on attendee email for lead matching
CREATE INDEX IF NOT EXISTS idx_meetings_attendee_email ON meetings(attendee_email);
