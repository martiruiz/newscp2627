-- Admin → Content ideas: a fast search. The old filter_content_ideas() checked every one of the ~560k posts against
-- each filter (a correlated subquery per row) and the search ran it twice (count + page): 4 s with no filter, a
-- timeout with a club. Now the tag filters become one set query on content_idea_tags (value_id, idea_id) — "any" =
-- posts with one of the values, "all" = posts with every value, filters intersected — run once for the page and the
-- total (a window count). Same arguments and same result shape as before.

-- the tag filters as a query returning idea_id, or null when there is no tag filter
create or replace function public.admin_idea_tag_sql(p_filters jsonb)
returns text language plpgsql immutable as $$
declare f record; ids text; n int; parts text[] := '{}';
begin
  for f in select key, value from jsonb_each(coalesce(p_filters, '{}'::jsonb))
           where jsonb_typeof(value -> 'ids') = 'array' and jsonb_array_length(value -> 'ids') > 0 loop
    ids := (select string_agg((x::bigint)::text, ',') from jsonb_array_elements_text(f.value -> 'ids') x);   -- numbers only
    n := jsonb_array_length(f.value -> 'ids');
    parts := parts || case when lower(coalesce(f.value ->> 'mode', 'any')) = 'all' and n > 1
      then format('select idea_id from public.content_idea_tags where value_id in (%s) group by idea_id having count(distinct value_id) = %s', ids, n)
      else format('select idea_id from public.content_idea_tags where value_id in (%s)', ids) end;
  end loop;
  return case when cardinality(parts) = 0 then null else array_to_string(parts, ' intersect ') end;
end $$;

create or replace function public.search_content_ideas(p_filters jsonb default '{}'::jsonb, p_q text default null, p_external_id text default null,
  p_from date default null, p_to date default null, p_page integer default 1, p_per_page integer default 25)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_per int := least(greatest(coalesce(p_per_page, 25), 1), 1000);
  v_page int := greatest(coalesce(p_page, 1), 1);
  q text := nullif(trim(p_q), ''); ext text := nullif(trim(p_external_id), '');
  t0 timestamptz := case when p_from is null then null else p_from::timestamp at time zone 'UTC' end;
  t1 timestamptz := case when p_to is null then null else (p_to + 1)::timestamp at time zone 'UTC' end;
  tags text := public.admin_idea_tag_sql(p_filters);
  v_total bigint; v_ids bigint[]; v_data jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if tags is null then
    if q is null and ext is null and t0 is null and t1 is null then
      select count(*) into v_total from public.content_ideas;
    else
      select count(*) into v_total from public.content_ideas c
      where (q is null or c.title ilike '%' || q || '%') and (ext is null or c.external_id ilike '%' || ext || '%')
        and (t0 is null or c.published_at >= t0) and (t1 is null or c.published_at < t1);
    end if;
    v_ids := array(select c.id from public.content_ideas c
      where (q is null or c.title ilike '%' || q || '%') and (ext is null or c.external_id ilike '%' || ext || '%')
        and (t0 is null or c.published_at >= t0) and (t1 is null or c.published_at < t1)
      order by c.published_at desc nulls last, c.id desc limit v_per offset (v_page - 1) * v_per);
  else
    -- the page: the posts in the tag set, newest first; the total: the tag set itself when nothing else filters
    execute format($q$ select array(select c.id from public.content_ideas c where c.id in (%s)
        and ($1::text is null or c.title ilike '%%' || $1 || '%%') and ($2::text is null or c.external_id ilike '%%' || $2 || '%%')
        and ($3::timestamptz is null or c.published_at >= $3) and ($4::timestamptz is null or c.published_at < $4)
        order by c.published_at desc nulls last, c.id desc limit $5 offset $6)$q$, tags)
      into v_ids using q, ext, t0, t1, v_per, (v_page - 1) * v_per;
    if q is null and ext is null and t0 is null and t1 is null then
      execute format('select count(distinct idea_id) from (%s) x', tags) into v_total;
    else
      execute format($q$ select count(*) from public.content_ideas c where c.id in (%s)
        and ($1::text is null or c.title ilike '%%' || $1 || '%%') and ($2::text is null or c.external_id ilike '%%' || $2 || '%%')
        and ($3::timestamptz is null or c.published_at >= $3) and ($4::timestamptz is null or c.published_at < $4)$q$, tags)
        into v_total using q, ext, t0, t1;
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'external_id', c.external_id, 'title', c.title, 'published_at', c.published_at,
           'embed', c.embed, 'url', c.url, 'import_id', c.import_id, 'tags', public.content_idea_tag_map(c.id))
         order by c.published_at desc nulls last, c.id desc), '[]'::jsonb)
    into v_data from public.content_ideas c where c.id = any (v_ids);
  return jsonb_build_object('data', v_data, 'meta', jsonb_build_object('total', v_total, 'current_page', v_page, 'per_page', v_per,
    'total_pages', greatest(ceil(v_total::numeric / v_per)::int, 1)));
end $$;

create or replace function public.search_content_idea_ids(p_filters jsonb default '{}'::jsonb, p_q text default null, p_external_id text default null,
  p_from date default null, p_to date default null)
returns bigint[] language plpgsql stable set search_path = public as $$
declare
  q text := nullif(trim(p_q), ''); ext text := nullif(trim(p_external_id), '');
  t0 timestamptz := case when p_from is null then null else p_from::timestamp at time zone 'UTC' end;
  t1 timestamptz := case when p_to is null then null else (p_to + 1)::timestamp at time zone 'UTC' end;
  tags text := public.admin_idea_tag_sql(p_filters);
  v bigint[];
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if tags is null then
    return coalesce((select array_agg(c.id order by c.published_at desc nulls last, c.id desc) from public.content_ideas c
      where (q is null or c.title ilike '%' || q || '%') and (ext is null or c.external_id ilike '%' || ext || '%')
        and (t0 is null or c.published_at >= t0) and (t1 is null or c.published_at < t1)), '{}');
  end if;
  execute format($q$ select array_agg(c.id order by c.published_at desc nulls last, c.id desc) from public.content_ideas c join (%s) cand on cand.idea_id = c.id
    where ($1::text is null or c.title ilike '%%' || $1 || '%%') and ($2::text is null or c.external_id ilike '%%' || $2 || '%%')
      and ($3::timestamptz is null or c.published_at >= $3) and ($4::timestamptz is null or c.published_at < $4)$q$, tags)
    into v using q, ext, t0, t1;
  return coalesce(v, '{}');
end $$;

drop function if exists public.admin_idea_tag_candidates(jsonb);
