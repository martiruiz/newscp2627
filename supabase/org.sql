-- Org: weekly content planner (adapted from the ASOBAL "organigrama"). Each member plans their own club's week.
-- Safe to re-run.

-- Planned posts: one row per piece of content in a week cell (day × hour)
create table if not exists public.org_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start    date not null,                                   -- Monday of the week
  day           smallint not null check (day between 0 and 6),   -- 0 = Monday
  time_slot     text not null check (time_slot ~ '^\d{2}:\d{2}$'),
  label         text not null default '' check (length(label) <= 140),
  status        text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'not_done')),
  content_type  text check (content_type in ('post', 'carousel', 'reel', 'story', 'video', 'tiktok')),
  copy          text check (length(copy) <= 5000),
  inspiration   text check (length(inspiration) <= 40),          -- "ci-<content idea id>" from the Content Library
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists org_entries_week_idx on public.org_entries (user_id, week_start);

-- Weekly base: the member's recurring posts (e.g. Monday 10:00 · Matchday recap reel)
create table if not exists public.org_base_slots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day           smallint not null check (day between 0 and 6),
  time_slot     text not null check (time_slot ~ '^\d{2}:\d{2}$'),
  label         text not null check (length(label) between 1 and 140),
  content_type  text check (content_type in ('post', 'carousel', 'reel', 'story', 'video', 'tiktok')),
  created_at    timestamptz not null default now()
);
create index if not exists org_base_user_idx on public.org_base_slots (user_id);

alter table public.org_entries enable row level security;
alter table public.org_base_slots enable row level security;
drop policy if exists "Own org entries" on public.org_entries;
create policy "Own org entries" on public.org_entries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Own org base" on public.org_base_slots;
create policy "Own org base" on public.org_base_slots for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
