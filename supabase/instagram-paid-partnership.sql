-- Instagram "Paid partnership" label (Bright Data: is_paid_partnership + partnership_details.username), Instagram only.
alter table public.content_ideas add column if not exists paid_partnership boolean;
alter table public.content_ideas add column if not exists paid_partner text;

create or replace function public.set_idea_scrape_extras(p_rows jsonb)
 returns integer language plpgsql security definer set search_path to 'public'
as $function$
declare n int;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then raise exception 'Not allowed'; end if;
  create temp table if not exists _extras (external_id text, handle text, hashtags text[], followers bigint, profile_name text, verified boolean, profile_image text, paid boolean, partner text) on commit drop;
  truncate _extras;
  insert into _extras
  select x ->> 'external_id', public.clean_handle(x ->> 'account'),
    nullif(array(select lower(trim(both '#' from trim(h))) from unnest(string_to_array(regexp_replace(coalesce(x ->> 'hashtags', ''), '[\s;|]+', ',', 'g'), ',')) h
                 where trim(both '#' from trim(h)) <> ''), '{}'),
    nullif(regexp_replace(coalesce(x ->> 'followers', ''), '[^0-9]', '', 'g'), '')::bigint,
    nullif(trim(x ->> 'profile_name'), ''),
    case lower(trim(coalesce(x ->> 'verified', ''))) when 'true' then true when '1' then true when 'sí' then true when 'yes' then true
      when 'false' then false when '0' then false when 'no' then false end,
    nullif(trim(x ->> 'profile_image'), ''),
    case lower(trim(coalesce(x ->> 'paid_partnership', ''))) when 'true' then true when '1' then true when 'sí' then true when 'yes' then true
      when 'false' then false when '0' then false when 'no' then false end,
    -- the brand: a plain @handle, or Bright Data's partnership_details object (as JSON or as text)
    nullif(lower(trim(both '@' from trim(case
      when jsonb_typeof(x -> 'paid_partner') = 'object' then x #>> '{paid_partner,username}'
      when coalesce(x ->> 'paid_partner', '') ~ '^\s*\{' then (x ->> 'paid_partner')::jsonb ->> 'username'
      else x ->> 'paid_partner' end))), '')
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x;

  -- the post: its hashtags and the account's followers at that moment; Instagram's paid partnership label
  update public.content_ideas c set hashtags = coalesce(e.hashtags, c.hashtags), account_followers = coalesce(e.followers, c.account_followers),
      paid_partnership = case when c.account_platform = 'instagram' then coalesce(e.paid, c.paid_partnership) else c.paid_partnership end,
      paid_partner = case when c.account_platform = 'instagram' and e.paid is not null then case when e.paid then e.partner end else c.paid_partner end
    from _extras e where c.external_id = e.external_id and (e.hashtags is not null or e.followers is not null or e.paid is not null);
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
end $function$;
