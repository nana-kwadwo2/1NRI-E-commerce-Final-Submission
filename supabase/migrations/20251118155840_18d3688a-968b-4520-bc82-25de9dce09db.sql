-- Add about_text and social_links to site_settings
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS about_text TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{"facebook": "", "instagram": "", "twitter": "", "tiktok": ""}'::jsonb;