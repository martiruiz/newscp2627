-- Likes, comments and shares of every post, read with its views (Edge Functions "views" and "views-cron",
-- pipeline/library/views.mjs): TikTok, YouTube and Instagram (likes and comments of photos and carousels too).
-- Run once in Supabase > SQL editor (after views-refresh.sql), then run views-cron.sql again. Safe to run again.
alter table public.content_ideas add column if not exists likes bigint;
alter table public.content_ideas add column if not exists comments bigint;
alter table public.content_ideas add column if not exists shares bigint;
