-- Performance, part 4: "Surprise me" and facet counts on very big selections. Run after performance-3.sql. Safe to re-run.
--   • "Surprise me" shuffles an even sample of about 5,000 posts of the selection (different for each shuffle) instead of
--     the whole selection — still random across all the library, but it doesn't have to sort 500,000 posts.
--   • Facet counts with several filters read an even sample of the tags (1 post in every k) and scale it up; the sample
--     is taken while reading the tags index, so it costs a fraction of a full count. Small selections stay exact.

-- Posts matching the tag filters, only those with id % k = r (k = 1 → all)
create or replace function public.ideas_matching_tags_sample(p_filters jsonb, p_k int, p_r int)
returns setof bigint language sql stable security invoker as $$
  with f as (
    select k, mode, ids from public.tag_filter_parts(p_filters)
  ),
  m as (
    select t.idea_id, f.k, count(*) as n, max(cardinality(f.ids)) as need, max(f.mode) as mode
    from f join public.content_idea_tags t on t.value_id = any (f.ids)
    where p_k <= 1 or t.idea_id % p_k = p_r
    group by t.idea_id, f.k
  )
  select idea_id from m where mode <> 'all' or n >= need
  group by idea_id having count(*) = (select count(*) from f);
$$;

-- "Surprise me": sample step for a selection of this size (about 5,000 posts per shuffle)
create or replace function public.shuffle_step(p_est bigint)
returns int language sql immutable as $$
  select greatest(1, ceil(coalesce(p_est, 0) / 5000.0))::int;
$$;

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
      and (p_ids is null or c.id = any (p_ids));
  else
    select count(*) into v_total from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
    where c.unavailable_at is null
      and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
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
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
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
  elsif k > 1 then
    -- big selection, "Surprise me": candidates from the sample only
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio, md5(c.id::text || coalesce(p_seed, '')) as k_shuffle
      from public.content_ideas c
      where (case when tagged then c.id in (select public.ideas_matching_tags_sample(p_filters, k, r)) else c.id % k = r end)
        and c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
        and (q is null or c.title ilike '%' || q || '%')
        and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
        and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
      order by k_shuffle
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio) order by p.k_shuffle), '[]'::jsonb)
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
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
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

-- Facet counts: exact when small, sampled (1 in k, scaled) when big
create or replace function public.library_filter_counts(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null)
returns table (value_id bigint, ideas bigint) language plpgsql stable security invoker set search_path = public as $$
declare
  q text := nullif(trim(p_q), '');
  only_tags boolean := q is null and p_from is null and p_to is null;
  parts int;
  v1 bigint; c1 int;
  est bigint;
  k int;
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
    est := coalesce(public.tag_filter_estimate(p_filters), 0);
    k := greatest(1, ceil(est / 40000.0))::int;   -- about 40,000 posts read at most
    return query
      select t.value_id, (count(*) * k)::bigint
      from (select public.ideas_matching_tags_sample(p_filters, k, 0) as id
            except select public.excluded_idea_ids()) s
      join public.content_idea_tags t on t.idea_id = s.id
      group by t.value_id;
    return;
  end if;
  -- search / dates: candidates from the posts table, counted on 1 in k when the selection is big
  est := case when parts > 0 then coalesce(public.tag_filter_estimate(p_filters), 0)
              else (select n from public.library_totals where key = 'library') end;
  k := case when q is null then greatest(1, ceil(est / 40000.0))::int else 1 end;  -- a text search is already a small set
  return query
    select t.value_id, (count(*) * k)::bigint
    from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
    join public.content_idea_tags t on t.idea_id = c.id
    where (k = 1 or c.id % k = 0)
      and c.unavailable_at is null
      and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
    group by t.value_id;
end $$;
