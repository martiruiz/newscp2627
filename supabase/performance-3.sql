-- Performance, part 3: the library page with filters, for any selection size. Run after performance-2.sql. Safe to re-run.
--   • Totals come from the cached counts whenever possible (one value, or two values in two categories), otherwise
--     they're counted from the tags index without touching the posts table.
--   • The page picks its strategy from the expected size: a small selection is read directly from the tags index;
--     a big one (e.g. all football) walks the date-ordered feed and stops after the page is full.
--   • Facet counts with several filters are computed on at most 60,000 posts (scaled up), so they never time out.
--   No temporary tables: everything is a plain read.

-- Posts never shown in the library (unavailable on the platform or removed by a superadmin) — a small set
-- (security definer: members can't read removed posts, but must be able to exclude their ids)
create or replace function public.excluded_idea_ids()
returns setof bigint language sql stable security definer set search_path = public as $$
  select id from public.content_ideas where unavailable_at is not null
  union
  select c.id from public.content_hidden h join public.content_ideas c on c.external_id = h.external_id;
$$;

-- The tag filters as rows: one per category with values
create or replace function public.tag_filter_parts(p_filters jsonb)
returns table (k int, mode text, ids bigint[]) language sql immutable as $$
  select (row_number() over ())::int, lower(coalesce(value ->> 'mode', 'any')),
         array(select jsonb_array_elements_text(value -> 'ids'))::bigint[]
  from jsonb_each(coalesce(p_filters, '{}'::jsonb))
  where jsonb_typeof(value -> 'ids') = 'array' and jsonb_array_length(value -> 'ids') > 0;
$$;

-- Expected number of posts for the tag filters (upper bound, from the cached counts)
create or replace function public.tag_filter_estimate(p_filters jsonb)
returns bigint language sql stable security invoker as $$
  select min(s) from (
    select p.k, coalesce(sum(n.ideas), 0) as s
    from public.tag_filter_parts(p_filters) p
    left join public.library_value_counts n on n.value_id = any (p.ids)
    group by p.k) x;
$$;

-- Exact count for tag filters only (no search / dates), as fast as possible
create or replace function public.tag_filter_total(p_filters jsonb)
returns bigint language plpgsql stable security invoker set search_path = public as $$
declare parts int; v1 bigint; v2 bigint; m1 text; m2 text; c1 int; c2 int; v_total bigint;
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
  select count(*) into v_total from (
    select public.ideas_matching_tags(p_filters) as id
    except select public.excluded_idea_ids()) x;
  return v_total;
end $$;

create or replace function public.library_ideas(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null,
  p_order text default 'latest', p_seed text default '', p_ids bigint[] default null, p_limit int default 24, p_offset int default 0,
  p_boost bigint[] default null, p_boost2 bigint[] default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  lim int := least(greatest(coalesce(p_limit, 24), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := nullif(trim(p_q), '');
  tagged boolean := public.has_tag_filters(p_filters);
  only_tags boolean := q is null and p_from is null and p_to is null and p_ids is null;
  small boolean := false;
  v_total bigint;
  v_data jsonb;
begin
  if tagged then small := coalesce(public.tag_filter_estimate(p_filters), 0) <= 20000; end if;

  -- Total
  if only_tags then
    v_total := public.tag_filter_total(p_filters);
  elsif small then
    select count(*) into v_total from public.content_ideas c
    where c.id in (select public.ideas_matching_tags(p_filters))
      and c.unavailable_at is null
      and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
      and (q is null or c.title ilike '%' || q || '%')
      and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
      and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
      and (p_ids is null or c.id = any (p_ids));
  else
    select count(*) into v_total from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
    where c.unavailable_at is null
      and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
      and (p_ids is null or c.id = any (p_ids));
  end if;

  -- Page
  if small then
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio,
        case when p_order = 'foryou' then
          case when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost, '{}'))) then 0
               when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost2, '{}'))) then 1
               else 2 end end as k_rank,
        case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as k_shuffle
      from public.content_ideas c
      where c.id in (select public.ideas_matching_tags(p_filters))
        and c.unavailable_at is null
        and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
        and (q is null or c.title ilike '%' || q || '%')
        and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
        and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
        and (p_ids is null or c.id = any (p_ids))
      order by k_rank nulls last, k_shuffle nulls last, c.published_at desc nulls last, c.id desc
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio) order by p.k_rank nulls last, p.k_shuffle nulls last, p.published_at desc nulls last, p.id desc), '[]'::jsonb)
    into v_data from page p;
  else
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio,
        case when p_order = 'foryou' then
          case when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost, '{}'))) then 0
               when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost2, '{}'))) then 1
               else 2 end end as k_rank,
        case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as k_shuffle
      from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
      where c.unavailable_at is null
        and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
        and (p_ids is null or c.id = any (p_ids))
      order by k_rank nulls last, k_shuffle nulls last, c.published_at desc nulls last, c.id desc
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio) order by p.k_rank nulls last, p.k_shuffle nulls last, p.published_at desc nulls last, p.id desc), '[]'::jsonb)
    into v_data from page p;
  end if;

  return jsonb_build_object('total', v_total, 'data', v_data);
end $$;

-- Facet counts
create or replace function public.library_filter_counts(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null)
returns table (value_id bigint, ideas bigint) language plpgsql stable security invoker set search_path = public as $$
declare
  q text := nullif(trim(p_q), '');
  only_tags boolean := q is null and p_from is null and p_to is null;
  parts int;
  v1 bigint; c1 int;
begin
  select count(*) into parts from public.tag_filter_parts(p_filters);
  if only_tags and parts = 0 then
    return query select n.value_id, n.ideas from public.library_value_counts n;
    return;
  end if;
  if only_tags and parts = 1 then
    select ids[1], cardinality(ids) into v1, c1 from public.tag_filter_parts(p_filters);
    if c1 = 1 then
      return query select pc.b, pc.ideas from public.library_pair_counts pc where pc.a = v1;
      return;
    end if;
  end if;
  if only_tags then
    return query
      with cand as materialized (select public.ideas_matching_tags(p_filters) as id except select public.excluded_idea_ids()),
           n as (select count(*)::numeric as c from cand),
           s as (select id from cand order by md5(id::text) limit 60000)
      select t.value_id, round(count(*) * (select c from n) / greatest(least((select c from n), 60000), 1))::bigint
      from s join public.content_idea_tags t on t.idea_id = s.id group by t.value_id;
    return;
  end if;
  return query
    with cand as materialized (
           select c.id from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
           where c.unavailable_at is null and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)),
         n as (select count(*)::numeric as c from cand),
         s as (select id from cand order by md5(id::text) limit 60000)
    select t.value_id, round(count(*) * (select c from n) / greatest(least((select c from n), 60000), 1))::bigint
    from s join public.content_idea_tags t on t.idea_id = s.id group by t.value_id;
end $$;
