-- Discovery Call transcript + AI summary columns on leads table
-- These are NEW columns only (never drop existing columns on leads table)

ALTER TABLE leads ADD COLUMN IF NOT EXISTS discovery_transcript TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS discovery_call_summary JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS discovery_call_processed_at TIMESTAMPTZ;
