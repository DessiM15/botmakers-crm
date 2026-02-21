-- Add portal invite/access tracking columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_invited_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_invite_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_last_login_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_first_login_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_onboarding_complete BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_access_revoked BOOLEAN NOT NULL DEFAULT false;
