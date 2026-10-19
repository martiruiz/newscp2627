-- ============================================================================================
-- Performance 7: filters that took 2–20 s.
-- 1. Totals of a filter with several values (e.g. Instagram + YouTube) were counted on every click (~2 s):
--    now counted once and kept in library_total_cache (emptied by refresh_library_stats() and after 6 hours).
-- 2. "For you" on a big filter timed out (8 s) when a tier was empty — e.g. Instagram with Instagram as favourite
--    platform: tiers 2 and 3 read all 370,000 posts to find none. Now the tiers run one after another and stop as soon as
--    the page is full; a tier whose values are rare is read from those values' posts instead of scanning the filter;
--    favourite platforms outside the platform filter are ignored (a post has one platform).
-- 3. Hidden posts are left out inside each tier (the page could come back with fewer than 24 posts).
-- Same 13 parameters as performance-6.sql (no new overload). Safe to re-run. Run it in Supabase → SQL editor.
-- ============================================================================================

-- ---------- 1. Cached totals ----------
create table if not exists public.library_total_cache (k text primary key, n bigint not null, made_at timestamptz not null default now());
alter table public.library_total_cache enable row level security;   -- no policies: only the functions below read / write it

create or replace function public.tag_filter_total(p_filters jsonb)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare parts int; v1 bigint; v2 bigint; m1 text; m2 text; c1 int; c2 int; v_total bigint; v_key text;
begin
  select count(*) into parts from public.tag_filter_parts(p_filters);
  if parts = 0 then return (select n from public.library_totals where key = 'library'); end if;
  select ids[1], mode, cardinality(ids) into v1, m1, c1 from public.tag_filter_parts(p_filters) where k = 1;
  if parts = 1 and c1 = 1 then
    return coalesce((select ideas from public.library_value_counts where value_id = v1), 0);
  end if;
  if parts = 2 then
    select ids[1], mode, cardinality(ids) into v2, m2, c2 from public.tag_filter_parts(p_filters) where k = 2;
    if c1 = 1 and c2 = 1 then
      return coalesce((select ideas from public.library_pair_counts where a = v1 and b = v2), 0);
    end if;
  end if;
  -- the same filters in any order give the same key
  select string_agg(x, '|' order by x) into v_key from (
    select p.mode || ':' || (select string_agg(i::text, ',' order by i) from unnest(p.ids) i) as x
    from public.tag_filter_parts(p_filters) p) s;
  select n into v_total from public.library_total_cache where library_total_cache.k = v_key and made_at > now() - interval '6 hours';
  if found then return v_total; end if;
  select count(*) into v_total from (
    select public.ideas_matching_tags(p_filters) as id
    except select public.excluded_idea_ids()) x;
  insert into public.library_total_cache (k, n, made_at) values (v_key, v_total, now())
    on conflict (k) do update set n = excluded.n, made_at = excluded.made_at;
  return v_total;
end $$;

create or replace function public.refresh_library_stats(p_part text default 'all')
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_part in ('all', 'values') then refresh materialized view concurrently public.library_value_counts; end if;
  if p_part in ('all', 'totals') then refresh materialized view concurrently public.library_totals; end if;
  if p_part in ('all', 'pairs') then refresh materialized view concurrently public.library_pair_counts; end if;
  delete from public.library_total_cache;
end $$;

-- ---------- 2. "For you" in tiers ----------
-- Posts of one tier, newest first: up to p_n ids. p_has: the post has one of these values; p_not: it has none of these.
-- p_by_tags: read the posts of p_has (few) instead of scanning the whole filter (many).
create or replace function public.library_tier(
  p_filters jsonb, p_q text, p_from date, p_to date, p_ids bigint[], p_by_views boolean, p_min_views bigint, p_max_views bigint,
  p_has bigint[], p_not bigint[], p_by_tags boolean, p_n int)
returns bigint[] language plpgsql stable security invoker set search_path = public as $$
declare v bigint[];
begin
  if p_n <= 0 then return '{}'; end if;
  if p_by_tags then
    select coalesce(array_agg(id), '{}') into v from (
      select c.id from (select distinct t.idea_id from public.content_idea_tags t where t.value_id = any (p_has)) b
      join public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c on c.id = b.idea_id
      where c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
        and (p_ids is null or c.id = any (p_ids))
        and (not p_by_views or c.views is not null) and (p_min_views is null or c.views >= p_min_views) and (p_max_views is null or c.views < p_max_views)
        and (cardinality(p_not) = 0 or not exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_not)))
      order by c.published_at desc nulls last, c.id desc limit p_n) x;
  else
    select coalesce(array_agg(id), '{}') into v from (
      select c.id from public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c
      where c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
        and (p_ids is null or c.id = any (p_ids))
        and (not p_by_views or c.views is not null) and (p_min_views is null or c.views >= p_min_views) and (p_max_views is null or c.views < p_max_views)
        and (p_has is null or exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_has)))
        and (cardinality(p_not) = 0 or not exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_not)))
      order by c.published_at desc nulls last, c.id desc limit p_n) x;
  end if;
  return v;
end $$;

-- ---------- 3. library_ideas ----------
create or replace function public.library_ideas(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null,
  p_order text default 'latest', p_seed text default '', p_ids bigint[] default null, p_limit int default 24, p_offset int default 0,
  p_boost bigint[] default null, p_boost2 bigint[] default null,
  p_min_views bigint default null, p_max_views bigint default null)
returns jsonb language plpgsql volatile security invoker set search_path = public as $$
declare
  lim int := least(greatest(coalesce(p_limit, 24), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := nullif(trim(p_q), '');
  tagged boolean := public.has_tag_filters(p_filters);
  by_views boolean := p_min_views is not null or p_max_views is not null or p_order = 'views';
  only_tags boolean := q is null and p_from is null and p_to is null and p_ids is null and not by_views;
  est bigint;
  small boolean := false;
  k int := 1;
  r int := 0;
  v_total bigint;
  v_data jsonb;
  b0 bigint[]; b1 bigint[]; pf bigint[]; got bigint[] := '{}'; ids bigint[];
begin
  est := case when tagged then coalesce(public.tag_filter_estimate(p_filters), 0)
              else (select n from public.library_totals where key = 'library') end;
  small := tagged and est <= 20000;
  -- "Surprise me" on a big selection: shuffle 1 post in every k (k and the offset r depend on the seed)
  if p_order = 'random' and not small and p_ids is null then
    k := public.shuffle_step(est);
    r := (abs(hashtext(coalesce(p_seed, ''))) % k)::int;
  end if;

  -- Total (always the whole selection)
  if only_tags then
    v_total := public.tag_filter_total(p_filters);
  elsif small then
    select count(*) into v_total from public.content_ideas c
    where c.id in (select public.ideas_matching_tags(p_filters))
      and c.unavailable_at is null
      and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
      and (q is null or c.title ilike '%' || q || '%')
      and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
      and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
      and (p_ids is null or c.id = any (p_ids))
      and (not by_views or c.views is not null)
      and (p_min_views is null or c.views >= p_min_views)
      and (p_max_views is null or c.views < p_max_views);
  else
    select count(*) into v_total from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
    where c.unavailable_at is null
      and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
      and (p_ids is null or c.id = any (p_ids))
      and (not by_views or c.views is not null)
      and (p_min_views is null or c.views >= p_min_views)
      and (p_max_views is null or c.views < p_max_views);
  end if;

  -- Page
  if small then
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio, c.cover_url, c.media_type, c.duration_s, c.views,
        case when p_order = 'foryou' then
          case when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost, '{}'))) then 0
               when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost2, '{}'))) then 1
               else 2 end end as k_rank,
        case when p_order = 'views' then c.views end as k_views,
        case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as k_shuffle
      from public.content_ideas c
      where c.id in (select public.ideas_matching_tags(p_filters))
        and c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
        and (q is null or c.title ilike '%' || q || '%')
        and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
        and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
        and (p_ids is null or c.id = any (p_ids))
        and (not by_views or c.views is not null)
        and (p_min_views is null or c.views >= p_min_views)
        and (p_max_views is null or c.views < p_max_views)
      order by k_rank nulls last, k_views desc nulls last, k_shuffle nulls last, c.published_at desc nulls last, c.id desc
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'cover_url', p.cover_url, 'media_type', p.media_type, 'duration_s', p.duration_s, 'views', p.views) order by p.k_rank nulls last, p.k_views desc nulls last, p.k_shuffle nulls last, p.published_at desc nulls last, p.id desc), '[]'::jsonb)
    into v_data from page p;
  elsif k > 1 then
    -- big selection, "Surprise me": 1 post in every k (the filters are checked only on those)
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio, c.cover_url, c.media_type, c.duration_s, c.views, md5(c.id::text || coalesce(p_seed, '')) as k_shuffle
      from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
      where c.id % k = r
      and (not by_views or c.views is not null)
      and (p_min_views is null or c.views >= p_min_views)
      and (p_max_views is null or c.views < p_max_views)
        and c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
      order by k_shuffle
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'cover_url', p.cover_url, 'media_type', p.media_type, 'duration_s', p.duration_s, 'views', p.views) order by p.k_shuffle), '[]'::jsonb)
    into v_data from page p;
  elsif p_order = 'foryou' then
    -- big selection, "For you": favourites → their sports / competitions → the rest, newest first in each tier.
    -- Each tier only runs if the ones before didn't fill the page.
    b0 := coalesce(p_boost, '{}'); b1 := coalesce(p_boost2, '{}');
    if jsonb_typeof(p_filters -> 'platform' -> 'ids') = 'array' and jsonb_array_length(p_filters -> 'platform' -> 'ids') > 0 then
      pf := array(select jsonb_array_elements_text(p_filters -> 'platform' -> 'ids'))::bigint[];
      b0 := array(select x from unnest(b0) x where x = any (pf)
                  or not exists (select 1 from public.idea_catalog ic where ic.id = x and ic.category = 'platform'));
    end if;
    b1 := array(select x from unnest(b1) x where x <> all (b0));
    if cardinality(b0) > 0 then
      got := public.library_tier(p_filters, q, p_from, p_to, p_ids, by_views, p_min_views, p_max_views, b0, '{}',
        coalesce((select sum(n.ideas) from public.library_value_counts n where n.value_id = any (b0)), 0) <= 60000, lim + off);
    end if;
    if cardinality(b1) > 0 and cardinality(got) < lim + off then
      got := got || public.library_tier(p_filters, q, p_from, p_to, p_ids, by_views, p_min_views, p_max_views, b1, b0,
        coalesce((select sum(n.ideas) from public.library_value_counts n where n.value_id = any (b1)), 0) <= 60000, lim + off - cardinality(got));
    end if;
    if cardinality(got) < lim + off then
      got := got || public.library_tier(p_filters, q, p_from, p_to, p_ids, by_views, p_min_views, p_max_views, null, b0 || b1, false, lim + off - cardinality(got));
    end if;
    ids := got[off + 1 : off + lim];
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'external_id', c.external_id, 'title', c.title,
        'published_at', c.published_at, 'embed', c.embed, 'url', c.url, 'tags', public.content_idea_tag_map(c.id),
        'media_ratio', c.media_ratio, 'cover_url', c.cover_url, 'media_type', c.media_type, 'duration_s', c.duration_s, 'views', c.views) order by u.n), '[]'::jsonb)
    into v_data from unnest(ids) with ordinality u(id, n) join public.content_ideas c on c.id = u.id;
  else
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio, c.cover_url, c.media_type, c.duration_s, c.views,
        case when p_order = 'views' then c.views end as k_views,
        case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as k_shuffle
      from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
      where c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
        and (p_ids is null or c.id = any (p_ids))
        and (not by_views or c.views is not null)
        and (p_min_views is null or c.views >= p_min_views)
        and (p_max_views is null or c.views < p_max_views)
      order by k_views desc nulls last, k_shuffle nulls last, c.published_at desc nulls last, c.id desc
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'cover_url', p.cover_url, 'media_type', p.media_type, 'duration_s', p.duration_s, 'views', p.views) order by p.k_views desc nulls last, p.k_shuffle nulls last, p.published_at desc nulls last, p.id desc), '[]'::jsonb)
    into v_data from page p;
  end if;

  return jsonb_build_object('total', v_total, 'data', v_data);
end $$;

grant execute on function public.library_tier(jsonb, text, date, date, bigint[], boolean, bigint, bigint, bigint[], bigint[], boolean, int) to authenticated;
