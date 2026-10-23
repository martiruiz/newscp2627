-- Social News: the preview picture of each news item, taken from the source article (its og:image).
-- Run once in Supabase (project "NOVA WEB SCP 2627"): SQL Editor → New query → paste → Run. Safe to run again.
-- The "Publish blog" Action fills it every hour for the news that don't have it yet ('' = the source has no picture).
alter table public.news add column if not exists image_url text;
