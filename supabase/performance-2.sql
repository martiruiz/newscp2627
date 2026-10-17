-- Performance, part 2: fast filters on a big library. Run after performance.sql. Safe to re-run; no data changes.
--   • Posts matching the selected filters are found from the tags index (value → posts) instead of checking every post.
--   • Facet counts for one selected value come from a cached "pairs" summary (how many posts share two values);
--     other combinations are counted live (sampled when the selection is huge, so it never times out).
--   • The pairs summary refreshes every night at 03:15 (pg_cron) and with refresh_library_stats('pairs').

-- Posts that match the tag filters ({"club": {"ids": [..], "mode": "any"|"all"}, ...}); every category must match
create or replace function public.ideas_matching_tags(p_filters jsonb)
returns setof bigint language sql stable security invoker as $$
  with f as (
    select row_number() over () as k, lower(coalesce(value ->> 'mode', 'any')) as mode,
           array(select jsonb_array_elements_text(value -> 'ids'))::bigint[] as ids
    from jsonb_each(coalesce(p_filters, '{}'::jsonb))
    where jsonb_typeof(value -> 'ids') = 'array' and jsonb_array_length(value -> 'ids') > 0
  ),
  m as (
    select t.idea_id, f.k, count(*) as n, max(cardinality(f.ids)) as need, max(f.mode) as mode
    from f join public.content_idea_tags t on t.value_id = any (f.ids)
    group by t.idea_id, f.k
  )
  select idea_id from m where mode <> 'all' or n >= need
  group by idea_id having count(*) = (select count(*) from f);
$$;

create or replace function public.has_tag_filters(p_filters jsonb)
returns boolean language sql immutable as $$
  select exists (select 1 from jsonb_each(coalesce(p_filters, '{}'::jsonb))
                 where jsonb_typeof(value -> 'ids') = 'array' and jsonb_array_length(value -> 'ids') > 0);
$$;

-- Library page
create or replace function public.library_ideas(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null,
  p_order text default 'latest', p_seed text default '', p_ids bigint[] default null, p_limit int default 24, p_offset int default 0,
  p_boost bigint[] default null, p_boost2 bigint[] default null)
returns jsonb language plpgsql volatile security invoker set search_path = public as $$
declare
  lim int := least(greatest(coalesce(p_limit, 24), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  tagged boolean := public.has_tag_filters(p_filters);
  q text := nullif(trim(p_q), '');
  v_total bigint;
  v_data jsonb;
begin
  if not tagged and q is null and p_from is null and p_to is null and p_ids is null then
    select n into v_total from public.library_totals where key = 'library';
  end if;

  create temp table if not exists _lib_ids (id bigint primary key) on commit drop;
  truncate _lib_ids;
  if tagged then insert into _lib_ids select public.ideas_matching_tags(p_filters); end if;

  if v_total is null then
    select count(*) into v_total
    from public.content_ideas c
    where (not tagged or c.id in (select id from _lib_ids))
      and c.unavailable_at is null
      and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
      and (q is null or c.title ilike '%' || q || '%')
      and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
      and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
      and (p_ids is null or c.id = any (p_ids));
  end if;

  with page as (
    select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio,
      case when p_order = 'foryou' then
        case when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost, '{}'))) then 0
             when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost2, '{}'))) then 1
             else 2 end end as k_rank,
      case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as k_shuffle
    from public.content_ideas c
    where (not tagged or c.id in (select id from _lib_ids))
      and c.unavailable_at is null
      and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
      and (q is null or c.title ilike '%' || q || '%')
      and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
      and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
      and (p_ids is null or c.id = any (p_ids))
    order by k_rank nulls last, k_shuffle nulls last, c.published_at desc nulls last, c.id desc
    limit lim offset off
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
      'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
      'media_ratio', p.media_ratio) order by p.k_rank nulls last, p.k_shuffle nulls last, p.published_at desc nulls last, p.id desc), '[]'::jsonb)
  into v_data from page p;

  return jsonb_build_object('total', v_total, 'data', v_data);
end $$;

-- How many posts share two values (for the facet counts when one value is selected)
create materialized view if not exists public.library_pair_counts as
  select a.value_id as a, b.value_id as b, count(*)::bigint as ideas
  from public.content_idea_tags a
  join public.content_idea_tags b on b.idea_id = a.idea_id
  join public.content_ideas c on c.id = a.idea_id
  where c.unavailable_at is null and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
  group by a.value_id, b.value_id;
create unique index if not exists library_pair_counts_pk on public.library_pair_counts (a, b);
grant select on public.library_pair_counts to authenticated;

create or replace function public.refresh_library_stats(p_part text default 'all')
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_part in ('all', 'values') then refresh materialized view concurrently public.library_value_counts; end if;
  if p_part in ('all', 'totals') then refresh materialized view concurrently public.library_totals; end if;
  if p_part in ('all', 'pairs') then refresh materialized view concurrently public.library_pair_counts; end if;
end $$;

-- Facet counts
create or replace function public.library_filter_counts(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null)
returns table (value_id bigint, ideas bigint) language plpgsql volatile security invoker set search_path = public as $$
declare
  q text := nullif(trim(p_q), '');
  plain boolean := q is null and p_from is null and p_to is null;
  only_id bigint;
  n_cand bigint;
begin
  if plain and not public.has_tag_filters(p_filters) then
    return query select n.value_id, n.ideas from public.library_value_counts n;
    return;
  end if;
  -- exactly one value selected (any mode): cached pairs
  if plain then
    select (array(select jsonb_array_elements_text(value -> 'ids'))::bigint[])[1] into only_id
    from jsonb_each(p_filters)
    where jsonb_typeof(value -> 'ids') = 'array' and jsonb_array_length(value -> 'ids') = 1
      and (select count(*) from jsonb_each(p_filters) e where jsonb_typeof(e.value -> 'ids') = 'array' and jsonb_array_length(e.value -> 'ids') > 0) = 1;
    if only_id is not null then
      return query select pc.b, pc.ideas from public.library_pair_counts pc where pc.a = only_id;
      return;
    end if;
  end if;
  -- live: candidate posts, sampled (and scaled up) above 60,000 so the request stays fast
  create temp table if not exists _cnt_ids (id bigint primary key) on commit drop;
  truncate _cnt_ids;
  if public.has_tag_filters(p_filters) then
    insert into _cnt_ids select c.id from public.content_ideas c
      where c.id in (select public.ideas_matching_tags(p_filters))
        and c.unavailable_at is null and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
        and (q is null or c.title ilike '%' || q || '%')
        and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
        and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'));
  else
    insert into _cnt_ids select c.id from public.content_ideas c
      where c.unavailable_at is null and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
        and (q is null or c.title ilike '%' || q || '%')
        and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
        and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'));
  end if;
  select count(*) into n_cand from _cnt_ids;
  if n_cand <= 60000 then
    return query select t.value_id, count(*)::bigint from _cnt_ids i join public.content_idea_tags t on t.idea_id = i.id group by t.value_id;
  else
    return query select t.value_id, round(count(*)::numeric * n_cand / 60000)::bigint
      from (select id from _cnt_ids order by md5(id::text) limit 60000) i join public.content_idea_tags t on t.idea_id = i.id group by t.value_id;
  end if;
end $$;

-- Nightly refresh of the cached counts (pg_cron, if available on the project)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'scp-library-stats';
  perform cron.schedule('scp-library-stats', '15 3 * * *', $c$select public.refresh_library_stats('all')$c$);
exception when others then
  raise notice 'pg_cron not available (%). Refresh with select public.refresh_library_stats(''all'') after big imports.', sqlerrm;
end $$;
