-- Free resources (lead magnets) — managed from the admin (admin/resources.html), shown on free-resources.html and on the
-- landing pages. Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Needs public.is_admin() (admin-content.sql) and public.newsletter_signups (newsletter.sql).

create table if not exists public.resources (
  id           bigint generated always as identity primary key,
  slug         text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),   -- also the value saved in newsletter_signups.resource
  title        text not null,
  description  text,                                   -- one or two sentences (library card and landing intro)
  bullets      text,                                   -- what's inside, one per line (landing page)
  status       text not null default 'soon' check (status in ('live', 'soon')),
  cover_url    text,
  file_url     text,                                   -- the PDF the visitor gets after leaving name + email
  landing_url  text,                                   -- empty = resource.html?r=<slug>; or a custom page (sports-content-calendar.html)
  sort         int  not null default 100,
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.resources enable row level security;
drop policy if exists "Public reads published resources" on public.resources;
create policy "Public reads published resources" on public.resources for select using (published = true);
drop policy if exists "Admins manage resources" on public.resources;
create policy "Admins manage resources" on public.resources for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.resources to anon, authenticated;
grant insert, update, delete on public.resources to authenticated;

-- files uploaded from the admin: bucket "resources" (public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resources', 'resources', true, 26214400, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true;
drop policy if exists "Anyone reads resource files" on storage.objects;
create policy "Anyone reads resource files" on storage.objects for select using (bucket_id = 'resources');
drop policy if exists "Admins upload resource files" on storage.objects;
create policy "Admins upload resource files" on storage.objects for insert to authenticated with check (bucket_id = 'resources' and public.is_admin());
drop policy if exists "Admins replace resource files" on storage.objects;
create policy "Admins replace resource files" on storage.objects for update to authenticated using (bucket_id = 'resources' and public.is_admin());

-- what is on the site today
insert into public.resources (slug, title, description, bullets, status, cover_url, file_url, landing_url, sort, published) values
 ('calendar-2026-27', 'Sports Content Calendar 2026–27', '28 key dates from October to May across 9 sports, each with a content angle you can use.',
  E'28 dates, 8 months, 9 sports\nA content angle for every date\nStatus on every date', 'live',
  'assets/resources/calendar-cover.webp', 'assets/resources/Sports-Content-Calendar-2026-27.pdf', 'sports-content-calendar.html', 10, true),
 ('content-ideas', 'The Moment Playbook', 'Six key moments in a club''s season, with real examples from the library, hooks to adapt and a checklist for each.',
  E'6 moments: match day, signing, return, club history, academy, tickets\nReal examples from the SCP library, labelled observed or hypothesis\nHook templates and a checklist for each moment', 'live',
  'assets/resources/moment-cover.webp', 'assets/resources/The-Moment-Playbook.pdf', null, 20, true),
 ('ai-prompts', 'Prompt Pack for Sports Social Managers', '14 ready-to-use prompts for hooks, captions, planning, sponsors and reporting, including how to turn a reference into your own post.',
  E'14 prompts to copy and paste\nA worked example from a real library post\nA fact-check step before you publish', 'live',
  'assets/resources/prompts-cover.webp', 'assets/resources/Prompt-Pack-Sports-Social-Managers.pdf', null, 30, true)
on conflict (slug) do nothing,
 ('content-ideas-november-2026', '6 Content Ideas for November 2026', 'Six content ideas for sports teams and brands, with real examples from the library, steps, hook templates and the key dates of the month.',
  E'6 ideas with steps and hook templates\n12 real examples from the SCP library, each with a link\nKey dates of November', 'live',
  'assets/resources/november-cover.webp', 'assets/resources/Content-Ideas-November-2026.pdf', null, 40, true)
on conflict (slug) do nothing;
