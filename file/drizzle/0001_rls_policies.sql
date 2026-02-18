-- ============================================================================
-- RLS Policies for Botmakers CRM
-- ============================================================================
-- Helper: team members are users whose ID exists in team_users with is_active=true
-- Helper: clients are users whose auth_user_id exists in clients table
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE team_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_demos ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- team_users: team can read, admin can write
-- ============================================================================
CREATE POLICY "team_users_select_team" ON team_users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "team_users_insert_admin" ON team_users
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.role = 'admin' AND tu.is_active = true)
  );

CREATE POLICY "team_users_update_admin" ON team_users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.role = 'admin' AND tu.is_active = true)
  );

CREATE POLICY "team_users_delete_admin" ON team_users
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.role = 'admin' AND tu.is_active = true)
  );

-- ============================================================================
-- clients: team all access, client can view own record
-- ============================================================================
CREATE POLICY "clients_select_team" ON clients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "clients_select_own" ON clients
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "clients_insert_team" ON clients
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "clients_update_team" ON clients
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "clients_update_own" ON clients
  FOR UPDATE USING (auth_user_id = auth.uid());

-- ============================================================================
-- leads: team only
-- ============================================================================
CREATE POLICY "leads_select_team" ON leads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "leads_insert_team" ON leads
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "leads_update_team" ON leads
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "leads_delete_team" ON leads
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- referrers: team only
-- ============================================================================
CREATE POLICY "referrers_select_team" ON referrers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "referrers_insert_team" ON referrers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "referrers_update_team" ON referrers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- contacts: team only
-- ============================================================================
CREATE POLICY "contacts_select_team" ON contacts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "contacts_insert_team" ON contacts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "contacts_update_team" ON contacts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "contacts_delete_team" ON contacts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- proposals: team all access, client can view own non-draft
-- ============================================================================
CREATE POLICY "proposals_select_team" ON proposals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "proposals_select_client" ON proposals
  FOR SELECT USING (
    status != 'draft'
    AND client_id IN (SELECT c.id FROM clients c WHERE c.auth_user_id = auth.uid())
  );

CREATE POLICY "proposals_insert_team" ON proposals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "proposals_update_team" ON proposals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "proposals_update_client" ON proposals
  FOR UPDATE USING (
    client_id IN (SELECT c.id FROM clients c WHERE c.auth_user_id = auth.uid())
  );

CREATE POLICY "proposals_delete_team" ON proposals
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- proposal_line_items: follows proposal access
-- ============================================================================
CREATE POLICY "proposal_line_items_select_team" ON proposal_line_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "proposal_line_items_select_client" ON proposal_line_items
  FOR SELECT USING (
    proposal_id IN (
      SELECT p.id FROM proposals p
      JOIN clients c ON p.client_id = c.id
      WHERE c.auth_user_id = auth.uid() AND p.status != 'draft'
    )
  );

CREATE POLICY "proposal_line_items_insert_team" ON proposal_line_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "proposal_line_items_update_team" ON proposal_line_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "proposal_line_items_delete_team" ON proposal_line_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- projects: team all access, client can view own
-- ============================================================================
CREATE POLICY "projects_select_team" ON projects
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "projects_select_client" ON projects
  FOR SELECT USING (
    client_id IN (SELECT c.id FROM clients c WHERE c.auth_user_id = auth.uid())
  );

CREATE POLICY "projects_insert_team" ON projects
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "projects_update_team" ON projects
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "projects_delete_team" ON projects
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- project_phases: follows project access
-- ============================================================================
CREATE POLICY "project_phases_select_team" ON project_phases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_phases_select_client" ON project_phases
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "project_phases_insert_team" ON project_phases
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_phases_update_team" ON project_phases
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_phases_delete_team" ON project_phases
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- project_milestones: follows project access (client view only)
-- ============================================================================
CREATE POLICY "project_milestones_select_team" ON project_milestones
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_milestones_select_client" ON project_milestones
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "project_milestones_insert_team" ON project_milestones
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_milestones_update_team" ON project_milestones
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_milestones_delete_team" ON project_milestones
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- project_repos: team only
-- ============================================================================
CREATE POLICY "project_repos_select_team" ON project_repos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_repos_insert_team" ON project_repos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_repos_update_team" ON project_repos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_repos_delete_team" ON project_repos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- project_demos: team all access, client can view approved only for own projects
-- ============================================================================
CREATE POLICY "project_demos_select_team" ON project_demos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_demos_select_client" ON project_demos
  FOR SELECT USING (
    is_approved = true
    AND project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "project_demos_insert_team" ON project_demos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_demos_update_team" ON project_demos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_demos_delete_team" ON project_demos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- project_questions: team all access, client can view/insert own
-- ============================================================================
CREATE POLICY "project_questions_select_team" ON project_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_questions_select_client" ON project_questions
  FOR SELECT USING (
    client_id IN (SELECT c.id FROM clients c WHERE c.auth_user_id = auth.uid())
  );

CREATE POLICY "project_questions_insert_team" ON project_questions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "project_questions_insert_client" ON project_questions
  FOR INSERT WITH CHECK (
    client_id IN (SELECT c.id FROM clients c WHERE c.auth_user_id = auth.uid())
  );

CREATE POLICY "project_questions_update_team" ON project_questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- invoices: team all access, client can view own
-- ============================================================================
CREATE POLICY "invoices_select_team" ON invoices
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "invoices_select_client" ON invoices
  FOR SELECT USING (
    client_id IN (SELECT c.id FROM clients c WHERE c.auth_user_id = auth.uid())
  );

CREATE POLICY "invoices_insert_team" ON invoices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "invoices_update_team" ON invoices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "invoices_delete_team" ON invoices
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- invoice_line_items: follows invoice access
-- ============================================================================
CREATE POLICY "invoice_line_items_select_team" ON invoice_line_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "invoice_line_items_select_client" ON invoice_line_items
  FOR SELECT USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_line_items_insert_team" ON invoice_line_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "invoice_line_items_update_team" ON invoice_line_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "invoice_line_items_delete_team" ON invoice_line_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- payments: team all access, client can view own
-- ============================================================================
CREATE POLICY "payments_select_team" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "payments_select_client" ON payments
  FOR SELECT USING (
    client_id IN (SELECT c.id FROM clients c WHERE c.auth_user_id = auth.uid())
  );

CREATE POLICY "payments_insert_team" ON payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- notifications: team only
-- ============================================================================
CREATE POLICY "notifications_select_team" ON notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "notifications_insert_team" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "notifications_update_team" ON notifications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- activity_log: team only
-- ============================================================================
CREATE POLICY "activity_log_select_team" ON activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "activity_log_insert_team" ON activity_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

-- ============================================================================
-- system_settings: team read, admin write
-- ============================================================================
CREATE POLICY "system_settings_select_team" ON system_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.is_active = true)
  );

CREATE POLICY "system_settings_insert_admin" ON system_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.role = 'admin' AND tu.is_active = true)
  );

CREATE POLICY "system_settings_update_admin" ON system_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.role = 'admin' AND tu.is_active = true)
  );

CREATE POLICY "system_settings_delete_admin" ON system_settings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_users tu WHERE tu.id = auth.uid() AND tu.role = 'admin' AND tu.is_active = true)
  );
