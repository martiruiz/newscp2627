-- Content creators' profile data: from the accounts Excel's "CONTENT CREATORS" tab (Type, Gender, Age, Language,
-- Followers, Location), uploaded in Admin → Scraped profiles. The followers are then read again once a week from the
-- public profile page (Edge Function "followers-cron", every hour ~10 profiles: Instagram rounds them, "694K").
-- Run after scraped-profiles.sql. Safe to run again (it replaces the save function and the schedule).

alter table public.scraped_profiles add column if not exists creator boolean not null default false;   -- in the creators' tab
alter table public.scraped_profiles add column if not exists creator_type text;     -- Content Creator, Designer, Humor…
alter table public.scraped_profiles add column if not exists gender text;
alter table public.scraped_profiles add column if not exists age text;
alter table public.scraped_profiles add column if not exists language text;
alter table public.scraped_profiles add column if not exists location text;
alter table public.scraped_profiles add column if not exists followers bigint;
alter table public.scraped_profiles add column if not exists followers_at timestamptz;   -- last read from the profile page
alter table public.scraped_profiles add column if not exists followers_source text;     -- excel | profile

-- the upload (same as before, plus the creators' columns). The Excel's followers only fill a profile that has none yet
-- or whose number also came from an Excel: a number read from the profile page is newer
create or replace function public.admin_scraped_profiles_save(p_rows jsonb, p_filename text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_added int; v_updated int; v_removed int; v_total int; v_premium int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  create temporary table _in on commit drop as
    select distinct on (lower(r ->> 'platform'), public.clean_handle(coalesce(nullif(r ->> 'handle', ''), r ->> 'url')))
      lower(trim(r ->> 'platform')) as platform, public.clean_handle(coalesce(nullif(r ->> 'handle', ''), r ->> 'url')) as handle,
      nullif(trim(r ->> 'name'), '') as name, nullif(trim(r ->> 'sport'), '') as sport, nullif(trim(r ->> 'competition'), '') as competition,
      nullif(trim(r ->> 'club'), '') as club, nullif(trim(r ->> 'url'), '') as url, coalesce((r ->> 'premium')::boolean, false) as premium,
      coalesce((r ->> 'creator')::boolean, false) as creator, nullif(trim(r ->> 'creator_type'), '') as creator_type,
      nullif(trim(r ->> 'gender'), '') as gender, nullif(trim(r ->> 'age'), '') as age, nullif(trim(r ->> 'language'), '') as language,
      nullif(trim(r ->> 'location'), '') as location, case when (r ->> 'followers') ~ '^\d+$' then (r ->> 'followers')::bigint end as followers
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
    where nullif(trim(r ->> 'platform'), '') is not null and public.clean_handle(coalesce(nullif(r ->> 'handle', ''), r ->> 'url')) is not null
    order by lower(r ->> 'platform'), public.clean_handle(coalesce(nullif(r ->> 'handle', ''), r ->> 'url')), coalesce((r ->> 'premium')::boolean, false) desc;
  select count(*), count(*) filter (where premium) into v_total, v_premium from _in;
  select count(*) into v_added from _in i where not exists (select 1 from public.scraped_profiles p where p.platform = i.platform and p.handle = i.handle);
  insert into public.scraped_profiles as p (platform, handle, name, sport, competition, club, url, premium, active,
      creator, creator_type, gender, age, language, location, followers, followers_source)
    select platform, handle, name, sport, competition, club, url, premium, true,
      creator, creator_type, gender, age, language, location, followers, case when followers is not null then 'excel' end from _in
  on conflict (platform, handle) do update set name = excluded.name, sport = excluded.sport, competition = excluded.competition, club = excluded.club,
    url = excluded.url, premium = excluded.premium, active = true, updated_at = now(),
    creator = excluded.creator, creator_type = coalesce(excluded.creator_type, p.creator_type), gender = coalesce(excluded.gender, p.gender),
    age = coalesce(excluded.age, p.age), language = coalesce(excluded.language, p.language), location = coalesce(excluded.location, p.location),
    followers = case when excluded.followers is not null and coalesce(p.followers_source, 'excel') = 'excel' then excluded.followers else p.followers end,
    followers_source = case when excluded.followers is not null and coalesce(p.followers_source, 'excel') = 'excel' then 'excel' else p.followers_source end;
  v_updated := v_total - v_added;
  update public.scraped_profiles p set active = false, updated_at = now()
    where p.active and not exists (select 1 from _in i where i.platform = p.platform and i.handle = p.handle);
  get diagnostics v_removed = row_count;
  insert into public.scraped_profile_uploads (filename, total, premium, added, updated, removed) values (p_filename, v_total, v_premium, v_added, v_updated, v_removed);
  return jsonb_build_object('total', v_total, 'premium', v_premium, 'added', v_added, 'updated', v_updated, 'removed', v_removed);
end $$;

-- creators whose followers are due: never read from their profile, or read more than a week ago
create or replace function public.followers_due(p_limit int default 10)
returns table (id bigint, platform text, handle text)
language sql stable security definer set search_path = public as $$
  select p.id, p.platform, p.handle from public.scraped_profiles p
  where p.active and p.creator and p.platform in ('instagram', 'tiktok')
    and (p.followers_at is null or p.followers_at < now() - interval '7 days')
  order by p.followers_at nulls first, p.id
  limit greatest(p_limit, 1);
$$;
revoke execute on function public.followers_due(int) from public, anon, authenticated;
grant execute on function public.followers_due(int) to service_role;   -- the Edge Function calls it with the service role
grant select, update on public.scraped_profiles to service_role;

-- every hour, ~10 creators (a full round of the creators well within the week, slow enough not to be blocked)
select cron.unschedule('scp-followers') where exists (select 1 from cron.job where jobname = 'scp-followers');
select cron.schedule('scp-followers', '17 * * * *', $c$
  select net.http_post(
    url := 'https://wppdbomtiliutpxsimtp.supabase.co/functions/v1/followers-cron',
    -- same as scp-views (supabase/views-cron.sql): the public key to reach the function, the vault secret to be let in
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_oq57pA0ZaavEQPDBYeWH-w_TRybCb05',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 150000)
$c$);
