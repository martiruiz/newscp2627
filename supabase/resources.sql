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
 ('content-ideas', 'Content ideas for every moment', 'Ready-to-adapt post ideas for match day, signings, results, behind the scenes and the off-season.', null, 'soon', null, null, null, 20, true),
 ('ai-prompts', 'AI prompts for sports community managers', 'Prompts to draft captions, plan the week and adapt a reference post to your club’s tone.', null, 'soon', null, null, null, 30, true)
on conflict (slug) do nothing;
