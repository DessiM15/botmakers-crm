-- 0008_services_documents_sync.sql
-- Adds 3rd-party service tracking, document vault, and project sync support

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE service_category AS ENUM (
    'hosting', 'domain', 'api', 'analytics', 'email', 'storage', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_cycle AS ENUM (
    'monthly', 'quarterly', 'annual', 'one_time'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE service_status AS ENUM (
    'active', 'expiring_soon', 'expired', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_category AS ENUM (
    'contract', 'design', 'brief', 'credentials', 'deliverable', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  project_id UUID REFERENCES projects(id),
  service_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  category service_category NOT NULL DEFAULT 'other',
  monthly_cost DECIMAL(10, 2) NOT NULL DEFAULT '0',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  renewal_date DATE,
  status service_status NOT NULL DEFAULT 'active',
  login_url TEXT,
  credentials_vault_url TEXT,
  account_identifier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  project_id UUID REFERENCES projects(id),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  category document_category NOT NULL DEFAULT 'other',
  description TEXT,
  is_portal_visible BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID REFERENCES team_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_client_services_client_id ON client_services(client_id);
CREATE INDEX IF NOT EXISTS idx_client_services_project_id ON client_services(project_id);
CREATE INDEX IF NOT EXISTS idx_client_services_status ON client_services(status);
CREATE INDEX IF NOT EXISTS idx_client_services_renewal_date ON client_services(renewal_date);
CREATE INDEX IF NOT EXISTS idx_client_services_created_at ON client_services(created_at);

CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

-- ── Project sync column ──────────────────────────────────────────────────────

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sync_api_key TEXT;
