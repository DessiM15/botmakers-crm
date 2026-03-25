-- Migration: Lead insert webhook trigger via pg_net
-- When a new lead is inserted, POST to the CRM webhook to fire notifications.
-- This bridges the website (which inserts leads) and the CRM (which needs to be notified).

-- Enable pg_net extension (available by default in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: POST to CRM webhook on new lead
CREATE OR REPLACE FUNCTION public.notify_crm_new_lead()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.crm_webhook_url', true),
    body := json_build_object('leadId', NEW.id)::jsonb,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.crm_webhook_secret', true)
    )::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the INSERT if the webhook fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists, then create
DROP TRIGGER IF EXISTS trg_new_lead_webhook ON leads;
CREATE TRIGGER trg_new_lead_webhook
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_crm_new_lead();

-- Also create a trigger for referrer-sourced leads (same mechanism)
-- The referrers table doesn't need a separate trigger — the lead itself is what matters.
-- When a referral lead is created, it goes into leads table with source='referral'.

-- To configure, run in Supabase SQL editor:
-- ALTER DATABASE postgres SET app.crm_webhook_url = 'https://crm.botmakers.ai/api/webhooks/new-lead';
-- ALTER DATABASE postgres SET app.crm_webhook_secret = '<your CRON_SECRET value>';
--
-- Or set per-session via:
-- SET app.crm_webhook_url = 'https://crm.botmakers.ai/api/webhooks/new-lead';
-- SET app.crm_webhook_secret = '<your CRON_SECRET value>';

-- Enable Realtime on in_app_notifications for push notifications
ALTER PUBLICATION supabase_realtime ADD TABLE in_app_notifications;
