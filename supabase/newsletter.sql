-- Newsletter sign-ups from the website (home dock pop-up). Safe to re-run.
-- Visitors can only INSERT (with consent); only admins can read the list (Admin → Audience).
create table if not exists public.newsletter_signups (
  id           bigint generated always as identity primary key,
  email        text not null unique check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  first_name   text check (length(first_name) <= 80),
  source       text not null default 'website' check (length(source) <= 40),
  resource     text check (length(resource) <= 80),           -- lead magnet promised at sign-up
  consent      boolean not null check (consent),
  consent_text text check (length(consent_text) <= 400),      -- exact wording they agreed to (GDPR record)
  created_at   timestamptz not null default now()
);
alter table public.newsletter_signups enable row level security;

drop policy if exists "Anyone can sign up" on public.newsletter_signups;
create policy "Anyone can sign up" on public.newsletter_signups for insert to anon, authenticated with check (consent);
drop policy if exists "Admins read sign-ups" on public.newsletter_signups;
create policy "Admins read sign-ups" on public.newsletter_signups for select to authenticated using (public.is_admin());
drop policy if exists "Admins delete sign-ups" on public.newsletter_signups;
create policy "Admins delete sign-ups" on public.newsletter_signups for delete to authenticated using (public.is_admin());

grant insert on public.newsletter_signups to anon, authenticated;

-- ---------- Automation with Resend ----------
-- Welcome email (Edge Function "newsletter-welcome", called by a Database Webhook on new sign-ups)
alter table public.newsletter_signups add column if not exists welcomed_at timestamptz;

-- Weekly issues (pipeline/newsletter/weekly.mjs): one row per week, so a week is never drafted twice
create table if not exists public.newsletter_issues (
  id            bigint generated always as identity primary key,
  week_start    date not null unique,
  subject       text not null,
  broadcast_id  text,                       -- Resend broadcast (draft until approved in Resend)
  items         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
alter table public.newsletter_issues enable row level security;
drop policy if exists "Admins read issues" on public.newsletter_issues;
create policy "Admins read issues" on public.newsletter_issues for select to authenticated using (public.is_admin());

-- Public bucket for images used in emails (Instagram image links expire, so they're copied here)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('newsletter', 'newsletter', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
