-- Phase 5: Proposal tracking columns + in-app notifications table

-- Add proposal tracking columns (safe: IF NOT EXISTS pattern via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'viewed_count') THEN
    ALTER TABLE proposals ADD COLUMN viewed_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'signed_at') THEN
    ALTER TABLE proposals ADD COLUMN signed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'signer_name') THEN
    ALTER TABLE proposals ADD COLUMN signer_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'signer_ip') THEN
    ALTER TABLE proposals ADD COLUMN signer_ip TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'signed_pdf_url') THEN
    ALTER TABLE proposals ADD COLUMN signed_pdf_url TEXT;
  END IF;
END $$;

-- Create in-app notifications table
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES team_users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast unread notification queries
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_unread
  ON in_app_notifications (user_id, is_read, created_at DESC);

-- RLS policies for in_app_notifications
ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

-- Team users can see their own notifications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'in_app_notif_select_own' AND tablename = 'in_app_notifications') THEN
    CREATE POLICY in_app_notif_select_own ON in_app_notifications
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- Team users can update their own notifications (mark as read)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'in_app_notif_update_own' AND tablename = 'in_app_notifications') THEN
    CREATE POLICY in_app_notif_update_own ON in_app_notifications
      FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

-- Service role can insert (server-side notification creation)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'in_app_notif_insert_service' AND tablename = 'in_app_notifications') THEN
    CREATE POLICY in_app_notif_insert_service ON in_app_notifications
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;
