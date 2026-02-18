-- Create email_drafts table
CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_lead_id UUID REFERENCES leads(id),
  recipient_client_id UUID REFERENCES clients(id),
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  category TEXT,
  tone TEXT,
  custom_instructions TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES team_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: team_users can CRUD all drafts
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage email drafts"
  ON email_drafts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_users
      WHERE team_users.id = auth.uid()
      AND team_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_users
      WHERE team_users.id = auth.uid()
      AND team_users.is_active = true
    )
  );
