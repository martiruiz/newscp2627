-- Scraped profiles (Admin → Scraped profiles, superadmins only): the accounts we send to Bright Data, uploaded from the
-- accounts Excel (the "premium" tab marks the premium ones). Each post knows its account, so we can tell how active
-- every profile is on SCP, warn when one goes quiet, report the premium ones' posts of the last 24 h, and filter the
-- library by creator. Run once in Supabase > SQL editor (after admin.sql). Safe to run again.

-- ---------- 1. The account of every post ----------
-- From the post URL when it has it (TikTok /@handle/, X /handle/status/, Instagram /handle/p/, YouTube /@handle);
-- the import can also send it (a column such as account / user_posted / profile_url: set_idea_accounts below).
alter table public.content_ideas add column if not exists account text;            -- handle, lower case, no @
alter table public.content_ideas add column if not exists account_platform text;   -- instagram, tiktok, x, youtube…

create or replace function public.platform_from_url(p_url text)
returns text language sql immutable as $$
  select case
    when p_url ~* 'instagram\.com' then 'instagram'
    when p_url ~* 'tiktok\.com' then 'tiktok'
    when p_url ~* '(^|[/.])(x|twitter)\.com' then 'x'
    when p_url ~* '(youtube\.com|youtu\.be)' then 'youtube'
    when p_url ~* 'facebook\.com' then 'facebook'
    when p_url ~* 'linkedin\.com' then 'linkedin'
  end;
$$;
create or replace function public.handle_from_url(p_url text)
returns text language sql immutable as $$
  select lower(coalesce(
    substring(p_url from '(?i)tiktok\.com/@([A-Za-z0-9._]+)'),
    substring(p_url from '(?i)(?:x|twitter)\.com/([A-Za-z0-9_]+)/status'),
    nullif(substring(p_url from '(?i)instagram\.com/([A-Za-z0-9._]+)/(?:p|reel|reels|tv)/'), 'stories'),
    substring(p_url from '(?i)youtube\.com/@([A-Za-z0-9._-]+)')));
$$;
-- a handle written any way (@Name, a profile URL, a post URL) → the bare handle
create or replace function public.clean_handle(p text)
returns text language sql immutable as $$
  select nullif(lower(trim(both '/' from coalesce(
    public.handle_from_url(p),
    substring(p from '(?i)(?:instagram|tiktok|x|twitter|youtube)\.com/@?([A-Za-z0-9._-]+)'),
    regexp_replace(trim(p), '^@', '')))), '');
$$;

create or replace function public.content_ideas_account() returns trigger language plpgsql as $$
begin
  if new.account is null and new.url is not null then new.account := public.handle_from_url(new.url); end if;
  if new.account_platform is null and new.url is not null then new.account_platform := public.platform_from_url(new.url); end if;
  return new;
end $$;
drop trigger if exists content_ideas_account on public.content_ideas;
create trigger content_ideas_account before insert or update of url on public.content_ideas
  for each row execute function public.content_ideas_account();

-- the posts we already have (TikTok and X carry the handle in the URL; Instagram /p/ links don't)
update public.content_ideas set account = public.handle_from_url(url), account_platform = public.platform_from_url(url)
  where account is null and url is not null and (url ~* 'tiktok\.com/@' or url ~* '(x|twitter)\.com/[^/]+/status' or url ~* 'instagram\.com/[^/]+/(p|reel|reels|tv)/' or url ~* 'youtube\.com/@');
update public.content_ideas set account_platform = public.platform_from_url(url) where account_platform is null and url is not null;
create index if not exists content_ideas_account_idx on public.content_ideas (account_platform, account, published_at desc) where account is not null;
create index if not exists content_ideas_account_added_idx on public.content_ideas (account_platform, account, created_at desc) where account is not null;

-- the import sends the account column when the file has one: [{ external_id, account }]
create or replace function public.set_idea_accounts(p_rows jsonb)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.content_ideas c set account = public.clean_handle(r ->> 'account')
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where c.external_id = r ->> 'external_id' and public.clean_handle(r ->> 'account') is not null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.set_idea_accounts(jsonb) from public, anon;
grant execute on function public.set_idea_accounts(jsonb) to authenticated;

-- ---------- 2. The profiles we scrape ----------
create table if not exists public.scraped_profiles (
  id            bigint generated always as identity primary key,
  platform      text not null,              -- instagram, tiktok, youtube, x…
  handle        text not null,              -- lower case, no @
  name          text,
  sport         text,
  competition   text,
  club          text,
  url           text,
  premium       boolean not null default false,   -- in the Excel's premium tab
  active        boolean not null default true,    -- false = no longer in the latest Excel
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (platform, handle)
);
alter table public.scraped_profiles enable row level security;   -- no policies: only the functions below

create table if not exists public.scraped_profile_uploads (
  id          bigint generated always as identity primary key,
  filename    text,
  total       int, premium int, added int, updated int, removed int,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.scraped_profile_uploads enable row level security;

-- warning thresholds (one row): "low activity" under N posts in 7 days, "no content" after N days without a post
create table if not exists public.scraped_profile_settings (
  id int primary key default 1 check (id = 1),
  low_posts_7d int not null default 2,
  stale_days int not null default 7
);
insert into public.scraped_profile_settings (id) values (1) on conflict do nothing;
alter table public.scraped_profile_settings enable row level security;

-- Save an uploaded Excel: [{platform, handle, name, sport, competition, club, url, premium}]; profiles that are no longer
-- in the file become inactive (their history stays)
create or replace function public.admin_scraped_profiles_save(p_rows jsonb, p_filename text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_added int; v_updated int; v_removed int; v_total int; v_premium int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  create temporary table _in on commit drop as
    select distinct on (lower(r ->> 'platform'), public.clean_handle(coalesce(nullif(r ->> 'handle', ''), r ->> 'url')))
      lower(trim(r ->> 'platform')) as platform, public.clean_handle(coalesce(nullif(r ->> 'handle', ''), r ->> 'url')) as handle,
      nullif(trim(r ->> 'name'), '') as name, nullif(trim(r ->> 'sport'), '') as sport, nullif(trim(r ->> 'competition'), '') as competition,
      nullif(trim(r ->> 'club'), '') as club, nullif(trim(r ->> 'url'), '') as url, coalesce((r ->> 'premium')::boolean, false) as premium
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
    where nullif(trim(r ->> 'platform'), '') is not null and public.clean_handle(coalesce(nullif(r ->> 'handle', ''), r ->> 'url')) is not null
    order by lower(r ->> 'platform'), public.clean_handle(coalesce(nullif(r ->> 'handle', ''), r ->> 'url')), coalesce((r ->> 'premium')::boolean, false) desc;
  select count(*), count(*) filter (where premium) into v_total, v_premium from _in;
  select count(*) into v_added from _in i where not exists (select 1 from public.scraped_profiles p where p.platform = i.platform and p.handle = i.handle);
  insert into public.scraped_profiles as p (platform, handle, name, sport, competition, club, url, premium, active)
    select platform, handle, name, sport, competition, club, url, premium, true from _in
  on conflict (platform, handle) do update set name = excluded.name, sport = excluded.sport, competition = excluded.competition, club = excluded.club,
    url = excluded.url, premium = excluded.premium, active = true, updated_at = now();
  v_updated := v_total - v_added;
  update public.scraped_profiles p set active = false, updated_at = now()
    where p.active and not exists (select 1 from _in i where i.platform = p.platform and i.handle = p.handle);
  get diagnostics v_removed = row_count;
  insert into public.scraped_profile_uploads (filename, total, premium, added, updated, removed) values (p_filename, v_total, v_premium, v_added, v_updated, v_removed);
  return jsonb_build_object('total', v_total, 'premium', v_premium, 'added', v_added, 'updated', v_updated, 'removed', v_removed);
end $$;

-- Every profile with its activity on SCP (posts in the library under its handle)
create or replace function public.admin_scraped_profiles()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.scraped_profile_settings;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into s from public.scraped_profile_settings where id = 1;
  return jsonb_build_object('settings', to_jsonb(s), 'uploads', coalesce((select jsonb_agg(to_jsonb(u) order by u.created_at desc) from (select * from public.scraped_profile_uploads order by created_at desc limit 5) u), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(to_jsonb(p) || to_jsonb(a) order by p.premium desc, p.platform, p.handle)
      from public.scraped_profiles p
      left join lateral (select max(c.published_at) as last_post, max(c.created_at) as last_added,
          count(*) filter (where c.published_at > now() - interval '7 days') as posts_7d,
          count(*) filter (where c.published_at > now() - interval '30 days') as posts_30d, count(*) as posts
        from public.content_ideas c where c.account_platform = p.platform and c.account = p.handle) a on true), '[]'::jsonb));
end $$;

-- The premium profiles' posts of the last N hours (added to SCP in that window, and published in it)
create or replace function public.admin_premium_report(p_hours int default 24)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return jsonb_build_object('since', now() - make_interval(hours => p_hours),
    'last_import', (select jsonb_build_object('id', id, 'filename', filename, 'at', coalesce(completed_at, created_at), 'rows', rows_created) from public.idea_imports where status = 'completed' order by coalesce(completed_at, created_at) desc limit 1),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('platform', p.platform, 'handle', p.handle, 'name', p.name, 'club', p.club,
        'added', a.added, 'published', a.published) order by p.platform, a.added desc, p.handle)
      from public.scraped_profiles p
      cross join lateral (select count(*) filter (where c.created_at > now() - make_interval(hours => p_hours)) as added,
          count(*) filter (where c.published_at > now() - make_interval(hours => p_hours)) as published
        from public.content_ideas c where c.account_platform = p.platform and c.account = p.handle
          and (c.created_at > now() - make_interval(hours => p_hours) or c.published_at > now() - make_interval(hours => p_hours))) a
      where p.premium and p.active and p.platform in ('instagram', 'tiktok')), '[]'::jsonb));
end $$;

create or replace function public.admin_scraped_profile_settings_save(p_low_posts_7d int, p_stale_days int)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.scraped_profile_settings set low_posts_7d = greatest(0, p_low_posts_7d), stale_days = greatest(1, p_stale_days) where id = 1;
end $$;

-- Content Library: the creators' accounts (for the creator filter) and the posts of one account
create or replace function public.creator_accounts()
returns table (platform text, handle text, name text, posts bigint)
language sql stable security definer set search_path = public as $$
  select c.account_platform, c.account, max(p.name), count(*)
  from public.content_ideas c
  join public.content_idea_tags t on t.idea_id = c.id
  join public.idea_catalog v on v.id = t.value_id and v.category = 'entity' and v.name = 'Content Creators'
  left join public.scraped_profiles p on p.platform = c.account_platform and p.handle = c.account
  where c.account is not null and c.unavailable_at is null
  group by 1, 2 order by count(*) desc limit 500;
$$;
create or replace function public.account_post_ids(p_platform text, p_handle text)
returns bigint[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id order by published_at desc nulls last), '{}') from (
    select id, published_at from public.content_ideas where account_platform = p_platform and account = p_handle and unavailable_at is null
    order by published_at desc nulls last limit 3000) x;
$$;

do $$
declare f text;
begin
  foreach f in array array['admin_scraped_profiles_save(jsonb, text)', 'admin_scraped_profiles()', 'admin_premium_report(int)', 'admin_scraped_profile_settings_save(int, int)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.creator_accounts() from public, anon;
grant execute on function public.creator_accounts() to authenticated;
revoke execute on function public.account_post_ids(text, text) from public, anon;
grant execute on function public.account_post_ids(text, text) to authenticated;
