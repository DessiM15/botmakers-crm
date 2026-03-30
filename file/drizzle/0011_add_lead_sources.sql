-- Add new lead source enum values: tiktok, social_media
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'tiktok';
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'social_media';
