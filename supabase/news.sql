-- Social News — automatically curated articles
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.news (
  id            bigint generated always as identity primary key,
  url           text not null unique,          -- original article (used to avoid duplicates)
  source_name   text not null,
  platform      text not null check (platform in (
                  'instagram', 'tiktok', 'x', 'youtube', 'facebook', 'linkedin',
                  'snapchat', 'whatsapp', 'pinterest', 'threads', 'ai', 'other')),
  title         text not null,
  paragraphs    text[] not null default '{}',
  relevant      boolean not null default false, -- adaptable to sports digital marketing?
  published_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists news_published_idx on public.news (published_at desc);

alter table public.news enable row level security;

-- Anyone can read published (relevant) news. Only the pipeline (service role) writes.
drop policy if exists "Public reads relevant news" on public.news;
create policy "Public reads relevant news" on public.news
  for select using (relevant = true);
