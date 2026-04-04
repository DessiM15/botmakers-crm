-- Demo Mode: add is_demo column to entity tables
-- This allows filtering between real and demo data per session

-- Add is_demo column to all entity tables
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE cost_entries ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE client_services ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_leads_is_demo ON leads (is_demo);
CREATE INDEX IF NOT EXISTS idx_clients_is_demo ON clients (is_demo);
CREATE INDEX IF NOT EXISTS idx_projects_is_demo ON projects (is_demo);
CREATE INDEX IF NOT EXISTS idx_proposals_is_demo ON proposals (is_demo);
CREATE INDEX IF NOT EXISTS idx_invoices_is_demo ON invoices (is_demo);
CREATE INDEX IF NOT EXISTS idx_payments_is_demo ON payments (is_demo);
CREATE INDEX IF NOT EXISTS idx_contacts_is_demo ON contacts (is_demo);
CREATE INDEX IF NOT EXISTS idx_activity_log_is_demo ON activity_log (is_demo);
CREATE INDEX IF NOT EXISTS idx_meetings_is_demo ON meetings (is_demo);
CREATE INDEX IF NOT EXISTS idx_cost_entries_is_demo ON cost_entries (is_demo);
CREATE INDEX IF NOT EXISTS idx_client_services_is_demo ON client_services (is_demo);

-- Backfill existing demo records (seeded by seed-demo.mjs with [DEMO] markers)
UPDATE leads SET is_demo = true WHERE notes LIKE '%[DEMO]%';
UPDATE clients SET is_demo = true WHERE notes LIKE '%[DEMO]%';
UPDATE projects SET is_demo = true WHERE description LIKE '%[DEMO]%';
UPDATE proposals SET is_demo = true WHERE scope_of_work LIKE '%[DEMO]%';
UPDATE invoices SET is_demo = true WHERE description LIKE '%[DEMO]%';
UPDATE contacts SET is_demo = true WHERE subject LIKE '%[DEMO]%';
UPDATE client_services SET is_demo = true WHERE notes LIKE '%[DEMO]%';
UPDATE activity_log SET is_demo = true WHERE metadata->>'demo' = 'true';

-- Backfill payments linked to demo invoices
UPDATE payments SET is_demo = true WHERE invoice_id IN (SELECT id FROM invoices WHERE is_demo = true);

-- Backfill cost entries linked to demo projects/clients
UPDATE cost_entries SET is_demo = true WHERE project_id IN (SELECT id FROM projects WHERE is_demo = true);
UPDATE cost_entries SET is_demo = true WHERE client_id IN (SELECT id FROM clients WHERE is_demo = true);
