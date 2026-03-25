-- Batch 2: Add notification type enum values for newly-wired actions
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'client_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'proposal_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'proposal_sent';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_sent';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'lead_assigned';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_rescheduled';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_cancelled';
