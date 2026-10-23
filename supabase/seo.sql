-- SEO for Google and AI assistants (Admin → Social News → SEO & AI, Admin → SEO).
-- Run once in Supabase (project "NOVA WEB SCP 2627"): Dashboard → SQL Editor → New query → paste → Run.
-- Needs supabase/admin-content.sql (public.is_admin()) run before. Safe to run again.

-- Social News: every published news item gets its own page news/<slug>.html (built by the "Publish blog" Action)
alter table public.news add column if not exists slug text unique;           -- set once by the Action, never changes
alter table public.news add column if not exists meta_title text;            -- blue link on Google (empty = the title)
alter table public.news add column if not exists meta_description text;      -- grey text on Google (empty = first lines)
alter table public.news add column if not exists takeaways text[] not null default '{}';  -- key points, shown on top
alter table public.news add column if not exists faq jsonb not null default '[]';         -- [{q, a}] → FAQPage schema

-- Admin → SEO: one row with the website's settings (AI crawlers, llms.txt, Organization schema)
create table if not exists public.seo_settings (
  id          int primary key default 1 check (id = 1),
  data        jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);
insert into public.seo_settings (id) values (1) on conflict (id) do nothing;

alter table public.seo_settings enable row level security;
drop policy if exists "Admins manage SEO settings" on public.seo_settings;
create policy "Admins manage SEO settings" on public.seo_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
