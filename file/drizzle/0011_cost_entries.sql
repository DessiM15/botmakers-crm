-- 0011_cost_entries.sql
-- Cost tracking for P&L analysis

-- Create enum for cost source
DO $$ BEGIN
  CREATE TYPE cost_source AS ENUM (
    'manual',
    'vercel',
    'anthropic',
    'square_fees',
    'supabase',
    'github',
    'resend',
    'upstash',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create cost_entries table
CREATE TABLE IF NOT EXISTS cost_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  project_id UUID REFERENCES projects(id),
  service_id UUID REFERENCES client_services(id),
  source cost_source NOT NULL DEFAULT 'manual',
  provider TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  external_id TEXT,
  metadata JSONB,
  created_by UUID REFERENCES team_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cost_entries_project_id ON cost_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_entries_client_id ON cost_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_cost_entries_period ON cost_entries(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_cost_entries_source ON cost_entries(source);

-- Unique partial index for dedup on auto-pulled entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_entries_source_external_id
  ON cost_entries(source, external_id)
  WHERE external_id IS NOT NULL;
