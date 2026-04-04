-- 0019: Email Campaigns
-- Adds campaign management tables for automated email outreach

-- ── Enums ──────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE campaign_audience_type AS ENUM ('clients', 'leads', 'all');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_type AS ENUM ('recurring', 'event');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_send_status AS ENUM ('queued', 'sent', 'delivered', 'opened', 'bounced', 'complained');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_trigger_type AS ENUM ('anniversary', 'holiday', 'dormant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Tables ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  audience_type campaign_audience_type NOT NULL DEFAULT 'clients',
  type campaign_type NOT NULL DEFAULT 'recurring',
  frequency TEXT NOT NULL DEFAULT 'weekly',
  send_day INTEGER NOT NULL DEFAULT 1,
  send_hour INTEGER NOT NULL DEFAULT 15,
  subject_template TEXT NOT NULL DEFAULT '',
  prompt_context TEXT,
  trigger_type campaign_trigger_type,
  trigger_config JSONB,
  status campaign_status NOT NULL DEFAULT 'active',
  last_generated_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES team_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status campaign_send_status NOT NULL DEFAULT 'queued',
  resend_message_id TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign_id ON campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_resend_id ON campaign_sends(resend_message_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_next_send ON campaigns(next_send_at);

-- ── Opt-out columns on existing tables ─────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS email_campaigns_opted_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS company_anniversary DATE;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_campaigns_opted_out BOOLEAN NOT NULL DEFAULT FALSE;
