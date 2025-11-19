-- Add hero_image_url column to site_settings
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS hero_image_url TEXT;