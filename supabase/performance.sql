-- Performance for a big library (500k+ posts, millions of tags). Run after quality.sql and stripe.sql. Safe to re-run;
-- no data is changed. What it does:
--   1. filter_content_ideas becomes "inlinable" (no SET clause): the planner can apply ORDER BY / LIMIT and read only the
--      columns it needs, instead of materialising every post with its embed HTML on each call.
--   2. RLS policies evaluate is_admin() once per query (not once per row); removed posts are an anti-join.
--   3. library_ideas reads only the page it shows; the total is exact with filters and cached without them.
--   4. Counts per filter value (catalog, library facets, Filters page header) come from a cached summary,
--      refreshed after each import / classification (refresh_library_stats()).
--   5. admin_db_stats(): database size, for Admin → Plans & AI (Supabase Free = 500 MB).

-- ---------- 1. Inlinable filter ----------
create or replace function public.filter_content_ideas(
  p_filters      jsonb default '{}'::jsonb,
  p_q            text  default null,
  p_external_id  text  default null,
  p_from         date  default null,
  p_to           date  default null
)
returns setof public.content_ideas
language sql
stable
security invoker
as $$
  select c.*
  from public.content_ideas c
  where (nullif(trim(p_q), '') is null or c.title ilike '%' || trim(p_q) || '%')
    and (nullif(trim(p_external_id), '') is null or c.external_id ilike '%' || trim(p_external_id) || '%')
    and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
    and (p_to   is null or c.published_at <  ((p_to + 1)::timestamp at time zone 'UTC'))
    and not exists (
      select 1
      from jsonb_each(coalesce(p_filters, '{}'::jsonb)) f(key, value)
      where jsonb_typeof(f.value -> 'ids') = 'array' and jsonb_array_length(f.value -> 'ids') > 0
        and case
          when lower(coalesce(f.value ->> 'mode', 'any')) = 'all' then
            (select count(*) from public.content_idea_tags t
              where t.idea_id = c.id and t.value_id = any (array(select jsonb_array_elements_text(f.value -> 'ids'))::bigint[]))
              < jsonb_array_length(f.value -> 'ids')
          else
            not exists (select 1 from public.content_idea_tags t
              where t.idea_id = c.id and t.value_id = any (array(select jsonb_array_elements_text(f.value -> 'ids'))::bigint[]))
        end
    );
$$;

-- ---------- Hidden posts: ids only, readable by members (reasons stay admin-only in content_removals) ----------
create table if not exists public.content_hidden (external_id text primary key);
alter table public.content_hidden enable row level security;
drop policy if exists "Members read hidden ids" on public.content_hidden;
create policy "Members read hidden ids" on public.content_hidden for select to authenticated using (true);
insert into public.content_hidden (external_id) select external_id from public.content_removals on conflict do nothing;
delete from public.content_hidden h where not exists (select 1 from public.content_removals r where r.external_id = h.external_id);
create or replace function public.sync_content_hidden() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then delete from public.content_hidden where external_id = old.external_id; return old; end if;
  insert into public.content_hidden (external_id) values (new.external_id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists content_removals_sync on public.content_removals;
create trigger content_removals_sync after insert or delete on public.content_removals for each row execute function public.sync_content_hidden();

-- ---------- 2. RLS: is_admin() once per query; removed posts as an anti-join ----------
drop policy if exists "Admins manage ideas" on public.content_ideas;
create policy "Admins manage ideas" on public.content_ideas for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins manage idea tags" on public.content_idea_tags;
create policy "Admins manage idea tags" on public.content_idea_tags for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins manage catalog" on public.idea_catalog;
create policy "Admins manage catalog" on public.idea_catalog for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Members read ideas" on public.content_ideas;
create policy "Members read ideas" on public.content_ideas for select to authenticated
  using ((select public.is_admin()) or not exists (select 1 from public.content_hidden r where r.external_id = content_ideas.external_id));

-- Feed order without unavailable posts
create index if not exists content_ideas_feed_idx on public.content_ideas (published_at desc nulls last, id desc) where unavailable_at is null;

-- ---------- 4. Cached counts (refreshed after imports / classification) ----------
create materialized view if not exists public.library_value_counts as
  select t.value_id, count(*)::bigint as ideas
  from public.content_idea_tags t
  join public.content_ideas c on c.id = t.idea_id
  where c.unavailable_at is null and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
  group by t.value_id;
create unique index if not exists library_value_counts_pk on public.library_value_counts (value_id);

create materialized view if not exists public.library_totals as
  select 'library'::text as key, count(*)::bigint as n
    from public.content_ideas c
    where c.unavailable_at is null and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
  union all
  select 'cat:' || v.category, count(distinct t.idea_id)::bigint
    from public.idea_catalog v join public.content_idea_tags t on t.value_id = v.id
    group by v.category;
create unique index if not exists library_totals_pk on public.library_totals (key);
grant select on public.library_value_counts, public.library_totals to authenticated;

-- Two calls so each one fits in the API time limit: refresh_library_stats('values') then refresh_library_stats('totals')
drop function if exists public.refresh_library_stats();
create or replace function public.refresh_library_stats(p_part text default 'all')
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_part in ('all', 'values') then refresh materialized view concurrently public.library_value_counts; end if;
  if p_part in ('all', 'totals') then refresh materialized view concurrently public.library_totals; end if;
end $$;
revoke execute on function public.refresh_library_stats(text) from public, anon;
grant execute on function public.refresh_library_stats(text) to authenticated;

create or replace function public.catalog_with_counts()
returns table (id bigint, category text, name text, ideas bigint)
language sql stable security invoker set search_path = public as $$
  select v.id, v.category, v.name, coalesce(n.ideas, 0)
  from public.idea_catalog v left join public.library_value_counts n on n.value_id = v.id
  order by v.category, lower(v.name);
$$;

create or replace function public.catalog_category_totals()
returns table (category text, ideas bigint)
language sql stable security invoker set search_path = public as $$
  select substr(key, 5), n from public.library_totals where key like 'cat:%';
$$;

-- ---------- 3. Library page: only the rows shown ----------
create or replace function public.library_ideas(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null,
  p_order text default 'latest', p_seed text default '', p_ids bigint[] default null, p_limit int default 24, p_offset int default 0,
  p_boost bigint[] default null, p_boost2 bigint[] default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  lim int := least(greatest(coalesce(p_limit, 24), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  plain boolean := coalesce(p_filters, '{}'::jsonb) = '{}'::jsonb and nullif(trim(p_q), '') is null and p_from is null and p_to is null and p_ids is null;
  v_total bigint;
  v_data jsonb;
begin
  if plain then
    select n into v_total from public.library_totals where key = 'library';
  end if;
  if v_total is null then
    select count(*) into v_total
    from public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c
    where c.unavailable_at is null
      and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
      and (p_ids is null or c.id = any (p_ids));
  end if;

  with page as (
    select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio,
      case when p_order = 'foryou' then
        case when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost, '{}'))) then 0
             when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost2, '{}'))) then 1
             else 2 end end as k_rank,
      case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as k_shuffle
    from public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c
    where c.unavailable_at is null
      and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
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

-- Facet counts: cached when nothing is filtered, live otherwise
create or replace function public.library_filter_counts(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null)
returns table (value_id bigint, ideas bigint) language plpgsql stable security invoker set search_path = public as $$
begin
  if coalesce(p_filters, '{}'::jsonb) = '{}'::jsonb and nullif(trim(p_q), '') is null and p_from is null and p_to is null then
    return query select n.value_id, n.ideas from public.library_value_counts n;
    return;
  end if;
  return query
    select t.value_id, count(*)::bigint
    from public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c
    join public.content_idea_tags t on t.idea_id = c.id
    where c.unavailable_at is null
      and not exists (select 1 from public.content_hidden r where r.external_id = c.external_id)
    group by t.value_id;
end $$;

-- ---------- 5. Database size (Admin) ----------
create or replace function public.admin_db_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_admin() then null else jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'content_ideas_bytes', pg_total_relation_size('public.content_ideas'),
    'content_idea_tags_bytes', pg_total_relation_size('public.content_idea_tags'),
    'idea_import_backups_bytes', pg_total_relation_size('public.idea_import_backups'),
    'posts', (select n from public.library_totals where key = 'library'),
    'tags', (select reltuples::bigint from pg_class where oid = 'public.content_idea_tags'::regclass)
  ) end;
$$;
revoke execute on function public.admin_db_stats() from public, anon;
grant execute on function public.admin_db_stats() to authenticated;

analyze public.content_ideas;
analyze public.content_idea_tags;
