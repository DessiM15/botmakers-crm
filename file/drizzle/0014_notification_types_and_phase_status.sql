-- Add missing notification_type enum values
-- These are needed for meeting notifications and other pipeline events
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_booked';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_cancelled';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_rescheduled';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_reminder';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'project_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_created';

-- Add completed_at column to project_phases for phase auto-completion tracking
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;
