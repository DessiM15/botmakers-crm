-- Allow internal (BotMakers-owned) services with no client
ALTER TABLE client_services ALTER COLUMN client_id DROP NOT NULL;

-- Partial index for quick lookup of internal services
CREATE INDEX IF NOT EXISTS idx_client_services_internal
  ON client_services (id) WHERE client_id IS NULL;
