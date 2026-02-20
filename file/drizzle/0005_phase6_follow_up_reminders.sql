-- Phase 6: Follow-up reminders table

CREATE TABLE IF NOT EXISTS follow_up_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  assigned_to UUID REFERENCES team_users(id),
  remind_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  trigger_reason TEXT,
  ai_draft_subject TEXT,
  ai_draft_body_html TEXT,
  ai_draft_body_text TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_reminders_status_remind
  ON follow_up_reminders (status, remind_at);

ALTER TABLE follow_up_reminders ENABLE ROW LEVEL SECURITY;

-- All team members can CRUD
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'follow_up_reminders_all' AND tablename = 'follow_up_reminders') THEN
    CREATE POLICY follow_up_reminders_all ON follow_up_reminders FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
