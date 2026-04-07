-- Add 'changes_requested' to proposal_status enum
ALTER TYPE proposal_status ADD VALUE IF NOT EXISTS 'changes_requested';

-- Add new columns to proposals table for decline/change workflows
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS change_request TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS change_requested_at TIMESTAMPTZ;

-- Add proposal_id to invoices table so deposit invoices can link to proposals
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES proposals(id);
