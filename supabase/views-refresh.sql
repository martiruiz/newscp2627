-- Content Library: YouTube and TikTok views are refreshed when a member plays the video (Edge Function "views").
-- views_at = when the views were last read from the platform (read again at most every 6 hours per post).
-- Run once in Supabase > SQL editor. Safe to run again.
alter table public.content_ideas add column if not exists views_at timestamptz;
