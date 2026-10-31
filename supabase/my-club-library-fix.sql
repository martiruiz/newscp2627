-- Fix: my-club-daily.sql put back the library_ideas of performance-7.sql, which undid performance-8.sql ("Surprise me" in
-- ~0.1 s). This is performance-8.sql's library_ideas again, with the My Club line (club-only posts only through My Club).
-- Run once in Supabase → SQL editor. Safe to re-run.
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
    k := 2;   -- read in shuffle_key order (below)
    r := (hashtext(coalesce(p_seed, ''))::bigint & 2147483647)::int;
  end if;

  -- Total (always the whole selection)
  if only_tags then
    v_total := public.tag_filter_total(p_filters);
  elsif small then
    select count(*) into v_total from public.content_ideas c
    where c.id in (select public.ideas_matching_tags(p_filters))
      and c.unavailable_at is null
      and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (not c.club_only or (p_ids is not null and public.club_post_ok(c.id)))
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
      and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (not c.club_only or (p_ids is not null and public.club_post_ok(c.id)))
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
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (not c.club_only or (p_ids is not null and public.club_post_ok(c.id)))
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
    -- big selection, "Surprise me": posts in shuffle_key order (a fixed random number per post, indexed), starting at a
    -- point that depends on the seed and wrapping round at the end — reads only the posts this page needs
    with
    a1 as (select c.*, 0 as k_lap from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
           where c.shuffle_key >= r and c.unavailable_at is null
             and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (not c.club_only or (p_ids is not null and public.club_post_ok(c.id)))
             and (not by_views or c.views is not null) and (p_min_views is null or c.views >= p_min_views) and (p_max_views is null or c.views < p_max_views)
           order by c.shuffle_key limit lim + off),
    a2 as (select c.*, 1 as k_lap from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
           where c.shuffle_key < r and c.unavailable_at is null
             and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (not c.club_only or (p_ids is not null and public.club_post_ok(c.id)))
             and (not by_views or c.views is not null) and (p_min_views is null or c.views >= p_min_views) and (p_max_views is null or c.views < p_max_views)
           order by c.shuffle_key limit lim + off),
    page as (select * from (select * from a1 union all select * from a2) u order by k_lap, shuffle_key limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'cover_url', p.cover_url, 'media_type', p.media_type, 'duration_s', p.duration_s, 'views', p.views) order by p.k_lap, p.shuffle_key), '[]'::jsonb)
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
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (not c.club_only or (p_ids is not null and public.club_post_ok(c.id)))
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
