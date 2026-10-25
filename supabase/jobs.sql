-- Jobs — job offers in sports digital marketing, added by hand from the admin (admin/jobs.html), shown on jobs.html
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.jobs (
  id            bigint generated always as identity primary key,
  title         text not null,
  company       text not null,
  logo_url      text,
  location      text,                                   -- city / country ("Barcelona, Spain")
  work_mode     text not null default 'onsite' check (work_mode in ('onsite', 'hybrid', 'remote')),
  job_type      text not null default 'full-time' check (job_type in ('full-time', 'part-time', 'internship', 'freelance')),
  area          text not null default 'social' check (area in ('social', 'content', 'design', 'video', 'marketing', 'partnerships', 'other')),
  summary       text,                                   -- two or three lines: what the job is
  apply_url     text not null,                          -- where to apply (the company's page, LinkedIn…)
  published     boolean not null default false,
  expires_at    date,                                   -- hidden from the page after this day
  created_at    timestamptz not null default now()
);

create index if not exists jobs_created_idx on public.jobs (created_at desc);

alter table public.jobs enable row level security;

-- Anyone sees the published offers that haven't expired; admins see and edit everything (public.is_admin(), admin-content.sql)
drop policy if exists "Public reads open jobs" on public.jobs;
create policy "Public reads open jobs" on public.jobs
  for select using (published = true and (expires_at is null or expires_at >= current_date));
drop policy if exists "Admins read all jobs" on public.jobs;
create policy "Admins read all jobs" on public.jobs for select to authenticated using (public.is_admin());
drop policy if exists "Admins add jobs" on public.jobs;
create policy "Admins add jobs" on public.jobs for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins edit jobs" on public.jobs;
create policy "Admins edit jobs" on public.jobs for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete jobs" on public.jobs;
create policy "Admins delete jobs" on public.jobs for delete to authenticated using (public.is_admin());
