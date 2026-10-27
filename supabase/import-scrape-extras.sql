-- More from the scraping (Bright Data · Instagram – Profiles): the import CSV can carry, per post, its hashtags and, per
-- account, followers, name, verified badge and profile picture link (columns in the import template). Kept on the post
-- (hashtags, followers when it was scraped) and on the account in Admin → Scraped profiles (followers of today, name,
-- verified, picture link). Optional columns: files without them import as before.
-- Run once in Supabase (SQL Editor). Safe to run again.
alter table public.content_ideas add column if not exists hashtags text[];
alter table public.content_ideas add column if not exists account_followers bigint;      -- the account's followers when scraped
alter table public.scraped_profiles add column if not exists is_verified boolean;
alter table public.scraped_profiles add column if not exists avatar_source text;          -- the platform's picture link (expires in days)
alter table public.scraped_profiles add column if not exists avatar_source_at timestamptz;

-- [{external_id, account, hashtags, followers, profile_name, verified, profile_image}] from the import
create or replace function public.set_idea_scrape_extras(p_rows jsonb)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  create temp table if not exists _extras (external_id text, handle text, hashtags text[], followers bigint, profile_name text, verified boolean, profile_image text) on commit drop;
  truncate _extras;
  insert into _extras
  select x ->> 'external_id', public.clean_handle(x ->> 'account'),
    nullif(array(select lower(trim(both '#' from trim(h))) from unnest(string_to_array(regexp_replace(coalesce(x ->> 'hashtags', ''), '[\s;|]+', ',', 'g'), ',')) h
                 where trim(both '#' from trim(h)) <> ''), '{}'),
    nullif(regexp_replace(coalesce(x ->> 'followers', ''), '[^0-9]', '', 'g'), '')::bigint,
    nullif(trim(x ->> 'profile_name'), ''),
    case lower(trim(coalesce(x ->> 'verified', ''))) when 'true' then true when '1' then true when 'sí' then true when 'yes' then true
      when 'false' then false when '0' then false when 'no' then false end,
    nullif(trim(x ->> 'profile_image'), '')
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x;

  -- the post: its hashtags and the account's followers at that moment
  update public.content_ideas c set hashtags = coalesce(e.hashtags, c.hashtags), account_followers = coalesce(e.followers, c.account_followers)
    from _extras e where c.external_id = e.external_id and (e.hashtags is not null or e.followers is not null);
  get diagnostics n = row_count;

  -- the account (Admin → Scraped profiles): one row per account, the latest values
  update public.scraped_profiles sp set
      followers = coalesce(a.followers, sp.followers),
      followers_at = case when a.followers is not null then now() else sp.followers_at end,
      followers_source = case when a.followers is not null then 'scrape' else sp.followers_source end,
      name = coalesce(nullif(sp.name, ''), a.profile_name),
      is_verified = coalesce(a.verified, sp.is_verified),
      avatar_source = coalesce(a.profile_image, sp.avatar_source),
      avatar_source_at = case when a.profile_image is not null then now() else sp.avatar_source_at end
    from (select distinct on (c.account_platform, e.handle) c.account_platform, e.handle, e.followers, e.profile_name, e.verified, e.profile_image
          from _extras e join public.content_ideas c on c.external_id = e.external_id
          where e.handle is not null) a
    where sp.platform = a.account_platform and sp.handle = a.handle;
  return n;
end $$;
revoke execute on function public.set_idea_scrape_extras(jsonb) from public, anon;
grant execute on function public.set_idea_scrape_extras(jsonb) to authenticated;
