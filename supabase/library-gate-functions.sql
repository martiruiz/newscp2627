-- Library gate, part 2: the library functions that run with their owner's rights (security definer) skip the table
-- rules of library-gate.sql, so each one checks the same thing itself — admins, or members whose plan includes the
-- library (public.library_allowed(), which lets everyone through while Admin → Memberships → Settings → "Require a
-- membership to use the Content Library" is off). Same results as before for them; nothing for an account without a plan.
-- Run after library-gate.sql (and memberships.sql). Safe to re-run.

-- Content creators' rows (creator-rows.sql)
create or replace function public.creator_rows()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when (select public.is_admin()) or (select public.library_allowed()) then (
  with cc as (select id from public.idea_catalog where category = 'entity' and name = 'Content Creators'),
  a as (select c.account_platform as platform, c.account as handle, count(*) as posts
    from public.content_ideas c
    where c.account is not null and c.unavailable_at is null
      and exists (select 1 from public.content_idea_tags t, cc where t.idea_id = c.id and t.value_id = cc.id)
    group by 1, 2)
  select coalesce(jsonb_agg(jsonb_build_object(
      'platform', a.platform, 'handle', a.handle, 'name', p.name, 'posts', a.posts, 'avatar', p.avatar_url,
      'followers', p.followers, 'type', p.creator_type, 'language', p.language, 'country', p.location, 'gender', p.gender,
      'collabs', (select coalesce(jsonb_agg(s.value_id), '[]'::jsonb) from (
          select t.value_id from public.content_ideas c
          join public.content_idea_tags t on t.idea_id = c.id
          join public.idea_catalog v on v.id = t.value_id and v.category = 'sponsor'
          where c.account_platform = a.platform and c.account = a.handle
          group by t.value_id order by count(*) desc limit 4) s),
      'top', (select coalesce(jsonb_agg(x.id), '[]'::jsonb) from (
          select c.id from public.content_ideas c
          where c.account_platform = a.platform and c.account = a.handle and c.unavailable_at is null and c.cover_url is not null
          order by c.views desc nulls last, c.published_at desc nulls last limit 4) x)
    ) order by p.followers desc nulls last, a.posts desc), '[]'::jsonb)
  from a left join public.scraped_profiles p on p.platform = a.platform and p.handle = a.handle
  ) else '[]'::jsonb end;
$$;

-- The creator accounts list (scraped-profiles.sql)
create or replace function public.creator_accounts()
returns table (platform text, handle text, name text, posts bigint)
language sql stable security definer set search_path = public as $$
  with cc as (select id from public.idea_catalog where category = 'entity' and name = 'Content Creators'),
  a as (select c.account_platform as platform, c.account as handle, count(*) as posts
    from public.content_ideas c
    where c.account is not null and c.unavailable_at is null
      and exists (select 1 from public.content_idea_tags t, cc where t.idea_id = c.id and t.value_id = cc.id)
    group by 1, 2 order by 3 desc limit 500)
  select a.platform, a.handle, p.name, a.posts from a
  left join public.scraped_profiles p on p.platform = a.platform and p.handle = a.handle
  where (select public.is_admin()) or (select public.library_allowed())
  order by a.posts desc;
$$;

-- One account's posts (scraped-profiles.sql)
create or replace function public.account_post_ids(p_platform text, p_handle text)
returns bigint[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id order by published_at desc nulls last), '{}') from (
    select id, published_at from public.content_ideas where account_platform = p_platform and account = p_handle and unavailable_at is null
      and ((select public.is_admin()) or (select public.library_allowed()))
    order by published_at desc nulls last limit 3000) x;
$$;

-- Posts by the creator's followers (creator-filters.sql)
create or replace function public.followers_post_ids(p_min bigint default null, p_max bigint default null)
returns bigint[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id order by published_at desc nulls last), '{}') from (
    select c.id, c.published_at from public.scraped_profiles p
    join public.content_ideas c on c.account_platform = p.platform and c.account = p.handle and c.unavailable_at is null
    where p.creator and p.active and p.followers is not null
      and (p_min is null or p.followers >= p_min) and (p_max is null or p.followers <= p_max)
      and ((select public.is_admin()) or (select public.library_allowed()))
    order by c.published_at desc nulls last limit 20000) x;
$$;

-- The filter cards' covers (value-covers.sql, value-covers-top.sql)
create or replace function public.value_covers(p_ids bigint[])
returns table (id bigint, cover text)
language sql stable security definer set search_path = public as $$
  select v.id, (
    select x.cover_url from (
      select c.cover_url, c.views from public.content_idea_tags t
      join public.content_ideas c on c.id = t.idea_id
      where t.value_id = v.id and c.cover_url is not null and c.unavailable_at is null
      order by t.idea_id desc limit 3000) x
    order by x.views desc nulls last limit 1)
  from unnest(p_ids[1:60]) as v(id)
  where (select public.is_admin()) or (select public.library_allowed());
$$;

create or replace function public.value_covers_top(p_ids bigint[])
returns table (id bigint, covers text[])
language sql stable security definer set search_path = public as $$
  select v.id, (
    select array_agg(x.cover_url order by x.views desc nulls last) from (
      select y.cover_url, y.views from (
        select c.cover_url, c.views from public.content_idea_tags t
        join public.content_ideas c on c.id = t.idea_id
        where t.value_id = v.id and c.cover_url is not null and c.unavailable_at is null
        order by t.idea_id desc limit 3000) y
      order by y.views desc nulls last limit 5) x)
  from unnest(p_ids[1:60]) as v(id)
  where (select public.is_admin()) or (select public.library_allowed());
$$;
