-- Performance indexes for Botmakers CRM
-- Foreign keys and commonly filtered/sorted columns

-- Leads
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads (pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads (score);
CREATE INDEX IF NOT EXISTS idx_leads_converted_to_client_id ON leads (converted_to_client_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);

-- Contacts
CREATE INDEX IF NOT EXISTS idx_contacts_lead_id ON contacts (lead_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts (created_at DESC);

-- Clients
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients (email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients (status);

-- Proposals
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON proposals (client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_lead_id ON proposals (lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals (status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals (created_at DESC);

-- Proposal Line Items
CREATE INDEX IF NOT EXISTS idx_proposal_line_items_proposal_id ON proposal_line_items (proposal_id);

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects (client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);

-- Project Phases
CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON project_phases (project_id);

-- Project Milestones
CREATE INDEX IF NOT EXISTS idx_project_milestones_phase_id ON project_milestones (phase_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones (project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_status ON project_milestones (status);
CREATE INDEX IF NOT EXISTS idx_project_milestones_due_date ON project_milestones (due_date);

-- Project Repos
CREATE INDEX IF NOT EXISTS idx_project_repos_project_id ON project_repos (project_id);
CREATE INDEX IF NOT EXISTS idx_project_repos_github ON project_repos (github_owner, github_repo);

-- Project Demos
CREATE INDEX IF NOT EXISTS idx_project_demos_project_id ON project_demos (project_id);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices (project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices (due_date);

-- Invoice Line Items
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items (invoice_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments (client_id);
CREATE INDEX IF NOT EXISTS idx_payments_square_payment_id ON payments (square_payment_id);

-- Questions
CREATE INDEX IF NOT EXISTS idx_questions_project_id ON questions (project_id);
CREATE INDEX IF NOT EXISTS idx_questions_client_id ON questions (client_id);

-- Activity Log
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON activity_log (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log (created_at DESC);

-- Notification Preferences
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences (user_id);

-- Team Users
CREATE INDEX IF NOT EXISTS idx_team_users_email ON team_users (email);
CREATE INDEX IF NOT EXISTS idx_team_users_is_active ON team_users (is_active);
