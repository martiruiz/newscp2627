-- ============================================================================================
-- Performance 6: "For you" on the whole library (or a big filter) without timing out.
-- 1. Removes the 11-parameter library_ideas() that the first version of this file created by mistake
--    (it clashed with the real one, which also takes p_min_views / p_max_views → "Could not choose the best candidate").
-- 2. library_ideas() as in library-filters.sql, plus a tiered "For you" for big selections: the member's favourites
--    first, then their sports / competitions, then the rest, newest first in each tier; each tier stops when the page is full.
-- Safe to re-run. Run it in Supabase → SQL editor.
-- ============================================================================================
drop function if exists public.library_ideas(jsonb, text, date, date, text, text, bigint[], integer, integer, bigint[], bigint[]);

create or replace function public.library_ideas(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null,
  p_order text default 'latest', p_seed text default '', p_ids bigint[] default null, p_limit int default 24, p_offset int default 0,
  p_boost bigint[] default null, p_boost2 bigint[] default null,
  p_min_views bigint default null, p_max_views bigint default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
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
    -- big selection, "For you": in tiers (favourites → their sports / competitions → the rest), newest first in each;
    -- each tier reads only the posts this page needs instead of ranking the whole library
    with
    t0 as (select c.*, 0 as k_rank from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
           where true and c.unavailable_at is null and (p_ids is null or c.id = any (p_ids))
             and (not by_views or c.views is not null) and (p_min_views is null or c.views >= p_min_views) and (p_max_views is null or c.views < p_max_views)
             and exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (coalesce(p_boost, '{}')))
           order by c.published_at desc nulls last, c.id desc limit lim + off),
    t1 as (select c.*, 1 as k_rank from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
           where true and c.unavailable_at is null and (p_ids is null or c.id = any (p_ids))
             and (not by_views or c.views is not null) and (p_min_views is null or c.views >= p_min_views) and (p_max_views is null or c.views < p_max_views)
             and exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (coalesce(p_boost2, '{}')))
             and not exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (coalesce(p_boost, '{}')))
           order by c.published_at desc nulls last, c.id desc limit lim + off),
    t2 as (select c.*, 2 as k_rank from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
           where true and c.unavailable_at is null and (p_ids is null or c.id = any (p_ids))
             and (not by_views or c.views is not null) and (p_min_views is null or c.views >= p_min_views) and (p_max_views is null or c.views < p_max_views)
             and not exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (coalesce(p_boost, '{}') || coalesce(p_boost2, '{}')))
           order by c.published_at desc nulls last, c.id desc limit lim + off),
    page as (
      select * from (select * from t0 union all select * from t1 union all select * from t2) u
      where not exists (select 1 from public.content_hidden h where h.external_id = u.external_id)
      order by k_rank, published_at desc nulls last, id desc
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'cover_url', p.cover_url, 'media_type', p.media_type, 'duration_s', p.duration_s, 'views', p.views) order by p.k_rank, p.published_at desc nulls last, p.id desc), '[]'::jsonb)
    into v_data from page p;
  else
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio, c.cover_url, c.media_type, c.duration_s, c.views,
        case when p_order = 'foryou' then
          case when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost, '{}'))) then 0
               when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost2, '{}'))) then 1
               else 2 end end as k_rank,
        case when p_order = 'views' then c.views end as k_views,
        case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as k_shuffle
      from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
      where c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
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
  end if;

  return jsonb_build_object('total', v_total, 'data', v_data);
end $$;
