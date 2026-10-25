-- Saved boards (saved.html): pin a board on top, give it an icon and choose its cover post.
-- Run once in Supabase (project "NOVA WEB SCP 2627"): SQL Editor → New query → paste → Run. Safe to run again.
-- Each member edits only their own boards (the folders RLS already in supabase/library.sql).
alter table public.folders add column if not exists pinned boolean not null default false;
alter table public.folders add column if not exists icon text check (char_length(icon) <= 32);   -- an icon name (js/icons.js)
alter table public.folders add column if not exists cover_post text check (char_length(cover_post) <= 40);   -- "ci-<id>"
