-- Sports Content Playbook — Admin back-end (content ideas, filter catalog, CSV imports)
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Requires supabase/schema.sql (profiles + roles) to have been run first.
-- Then run supabase/admin-catalog-seed.sql to load the filter values from the previous back-end.
--
-- Only superadmins can read or change anything here.

-- ---------------------------------------------------------------------------
-- 0. Helper: is the current user an admin?
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- Filter values (the "catalog"): one row per value, grouped by category.
create table if not exists public.idea_catalog (
  id          bigint generated always as identity primary key,
  category    text not null check (category in ('trend', 'sport', 'entity', 'competition', 'club', 'format', 'platform', 'campaign')),
  name        text not null check (length(trim(name)) > 0),
  created_at  timestamptz not null default now(),
  unique (category, name)
);
create index if not exists idea_catalog_category_idx on public.idea_catalog (category, name);

-- CSV imports (history, status and totals). The original file is kept in Storage (bucket "imports").
create table if not exists public.idea_imports (
  id             bigint generated always as identity primary key,
  filename       text not null,
  file_path      text,
  status         text not null default 'analyzed' check (status in ('analyzed', 'importing', 'completed', 'reverted', 'failed')),
  total_rows     int not null default 0,
  rows_created   int,
  rows_replaced  int,
  rows_skipped   int,
  error_count    int not null default 0,
  errors         jsonb not null default '[]'::jsonb,
  new_values     jsonb not null default '{}'::jsonb,
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  reverted_at    timestamptz
);
create index if not exists idea_imports_created_idx on public.idea_imports (created_at desc);

-- Content ideas (one social post each). external_id is the platform's post id and must be unique.
create table if not exists public.content_ideas (
  id            bigint generated always as identity primary key,
  external_id   text not null unique check (length(trim(external_id)) > 0),
  title         text,
  published_at  timestamptz,
  embed         text,
  url           text,
  import_id     bigint references public.idea_imports (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists content_ideas_published_idx on public.content_ideas (published_at desc nulls last, id desc);
create index if not exists content_ideas_import_idx on public.content_ideas (import_id);

-- Links between ideas and filter values (many-to-many).
create table if not exists public.content_idea_tags (
  idea_id   bigint not null references public.content_ideas (id) on delete cascade,
  value_id  bigint not null references public.idea_catalog (id) on delete cascade,
  primary key (idea_id, value_id)
);
create index if not exists content_idea_tags_value_idx on public.content_idea_tags (value_id, idea_id);

-- Copies of ideas that an import replaced, so the import can be reverted.
create table if not exists public.idea_import_backups (
  import_id    bigint not null references public.idea_imports (id) on delete cascade,
  external_id  text not null,
  data         jsonb not null,
  primary key (import_id, external_id)
);

-- ---------------------------------------------------------------------------
-- 2. Row Level Security: admins only
-- ---------------------------------------------------------------------------
alter table public.idea_catalog        enable row level security;
alter table public.idea_imports        enable row level security;
alter table public.content_ideas       enable row level security;
alter table public.content_idea_tags   enable row level security;
alter table public.idea_import_backups enable row level security;

drop policy if exists "Admins manage catalog" on public.idea_catalog;
create policy "Admins manage catalog" on public.idea_catalog for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage imports" on public.idea_imports;
create policy "Admins manage imports" on public.idea_imports for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage ideas" on public.content_ideas;
create policy "Admins manage ideas" on public.content_ideas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage idea tags" on public.content_idea_tags;
create policy "Admins manage idea tags" on public.content_idea_tags for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage import backups" on public.idea_import_backups;
create policy "Admins manage import backups" on public.idea_import_backups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Filtering
--    p_filters: {"sport": {"ids": [1, 2], "mode": "any"}, "club": {"ids": [7], "mode": "all"}, ...}
--    ANY = the idea has at least one of the values; ALL = the idea has every one of them.
-- ---------------------------------------------------------------------------
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
set search_path = public
as $$
  with f as (
    select lower(coalesce(value ->> 'mode', 'any')) as mode,
           array(select jsonb_array_elements_text(value -> 'ids'))::bigint[] as ids
    from jsonb_each(coalesce(p_filters, '{}'::jsonb))
    where jsonb_typeof(value -> 'ids') = 'array' and jsonb_array_length(value -> 'ids') > 0
  )
  select c.*
  from public.content_ideas c
  where (nullif(trim(p_q), '') is null or c.title ilike '%' || trim(p_q) || '%')
    and (nullif(trim(p_external_id), '') is null or c.external_id ilike '%' || trim(p_external_id) || '%')
    and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
    and (p_to   is null or c.published_at <  ((p_to + 1)::timestamp at time zone 'UTC'))
    and not exists (
      select 1 from f
      where case
        when f.mode = 'all' then
          (select count(*) from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (f.ids)) < cardinality(f.ids)
        else
          not exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (f.ids))
      end
    );
$$;

-- Tags of one idea, grouped by category: {"sport": [{"id": 1, "name": "Football"}], ...}
create or replace function public.content_idea_tag_map(p_idea_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_object_agg(category, vals), '{}'::jsonb)
  from (
    select v.category, jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name) order by v.name) as vals
    from public.content_idea_tags t
    join public.idea_catalog v on v.id = t.value_id
    where t.idea_id = p_idea_id
    group by v.category
  ) g;
$$;

-- One page of ideas (newest first) + total.
create or replace function public.search_content_ideas(
  p_filters      jsonb default '{}'::jsonb,
  p_q            text  default null,
  p_external_id  text  default null,
  p_from         date  default null,
  p_to           date  default null,
  p_page         int   default 1,
  p_per_page     int   default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_total bigint;
  v_data  jsonb;
  v_per   int := least(greatest(coalesce(p_per_page, 25), 1), 1000);
  v_page  int := greatest(coalesce(p_page, 1), 1);
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;

  select count(*) into v_total from public.filter_content_ideas(p_filters, p_q, p_external_id, p_from, p_to);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'external_id', c.external_id, 'title', c.title, 'published_at', c.published_at,
           'embed', c.embed, 'url', c.url, 'import_id', c.import_id, 'tags', public.content_idea_tag_map(c.id)
         ) order by c.published_at desc nulls last, c.id desc), '[]'::jsonb)
  into v_data
  from (
    select * from public.filter_content_ideas(p_filters, p_q, p_external_id, p_from, p_to)
    order by published_at desc nulls last, id desc
    limit v_per offset (v_page - 1) * v_per
  ) c;

  return jsonb_build_object(
    'data', v_data,
    'meta', jsonb_build_object('total', v_total, 'current_page', v_page, 'per_page', v_per,
                               'total_pages', greatest(ceil(v_total::numeric / v_per)::int, 1))
  );
end;
$$;

-- All ids matching the filters (used by "select all" for bulk actions and for CSV export).
create or replace function public.search_content_idea_ids(
  p_filters      jsonb default '{}'::jsonb,
  p_q            text  default null,
  p_external_id  text  default null,
  p_from         date  default null,
  p_to           date  default null
)
returns bigint[]
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return coalesce((select array_agg(id order by published_at desc nulls last, id desc)
                   from public.filter_content_ideas(p_filters, p_q, p_external_id, p_from, p_to)), '{}');
end;
$$;

-- Full rows for a list of ids (CSV export).
create or replace function public.content_ideas_by_ids(p_ids bigint[])
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'external_id', c.external_id, 'title', c.title, 'published_at', c.published_at,
           'embed', c.embed, 'url', c.url, 'tags', public.content_idea_tag_map(c.id)
         ) order by array_position(p_ids, c.id)), '[]'::jsonb)
  from public.content_ideas c
  where c.id = any (p_ids);
$$;

-- How many of the filtered ideas carry each value (numbers shown in the filter dropdowns).
create or replace function public.available_filter_counts(
  p_filters      jsonb default '{}'::jsonb,
  p_q            text  default null,
  p_external_id  text  default null,
  p_from         date  default null,
  p_to           date  default null
)
returns table (value_id bigint, ideas bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.value_id, count(*)
  from public.filter_content_ideas(p_filters, p_q, p_external_id, p_from, p_to) c
  join public.content_idea_tags t on t.idea_id = c.id
  group by t.value_id;
$$;

-- Every catalog value with the number of ideas linked to it (Filters page).
create or replace function public.catalog_with_counts()
returns table (id bigint, category text, name text, ideas bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select v.id, v.category, v.name, count(t.idea_id)
  from public.idea_catalog v
  left join public.content_idea_tags t on t.value_id = v.id
  group by v.id
  order by v.category, lower(v.name);
$$;

-- Ideas linked to at least one value of each category (header of the Filters page).
create or replace function public.catalog_category_totals()
returns table (category text, ideas bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select v.category, count(distinct t.idea_id)
  from public.idea_catalog v
  join public.content_idea_tags t on t.value_id = v.id
  group by v.category;
$$;

-- ---------------------------------------------------------------------------
-- 4. Writing ideas
-- ---------------------------------------------------------------------------

-- Find a catalog value by name (case-insensitive) or create it. Returns its id.
create or replace function public.catalog_value_id(p_category text, p_name text)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id bigint;
  v_name text := trim(regexp_replace(p_name, '\s+', ' ', 'g'));
begin
  if v_name is null or v_name = '' then return null; end if;
  select id into v_id from public.idea_catalog where category = p_category and name = v_name;
  if v_id is null then
    select id into v_id from public.idea_catalog where category = p_category and lower(name) = lower(v_name) order by id limit 1;
  end if;
  if v_id is null then
    insert into public.idea_catalog (category, name) values (p_category, v_name)
    on conflict (category, name) do update set name = excluded.name
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Create (p_id null) or update one idea and replace its filter values.
create or replace function public.save_content_idea(p_id bigint, p_data jsonb, p_value_ids bigint[])
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id bigint := p_id;
  v_ext text := nullif(trim(p_data ->> 'external_id'), '');
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if v_ext is null then raise exception 'External ID is required'; end if;
  if exists (select 1 from public.content_ideas where external_id = v_ext and (v_id is null or id <> v_id)) then
    raise exception 'External ID "%" already exists', v_ext;
  end if;

  if v_id is null then
    insert into public.content_ideas (external_id, title, published_at, embed, url)
    values (v_ext, nullif(p_data ->> 'title', ''), nullif(p_data ->> 'published_at', '')::timestamptz,
            nullif(p_data ->> 'embed', ''), nullif(p_data ->> 'url', ''))
    returning id into v_id;
  else
    update public.content_ideas set
      external_id  = v_ext,
      title        = nullif(p_data ->> 'title', ''),
      published_at = nullif(p_data ->> 'published_at', '')::timestamptz,
      embed        = nullif(p_data ->> 'embed', ''),
      url          = coalesce(nullif(p_data ->> 'url', ''), url),
      updated_at   = now()
    where id = v_id;
    if not found then raise exception 'Content idea % not found', v_id; end if;
    delete from public.content_idea_tags where idea_id = v_id;
  end if;

  insert into public.content_idea_tags (idea_id, value_id)
  select v_id, x from unnest(coalesce(p_value_ids, '{}')) as x
  on conflict do nothing;
  return v_id;
end;
$$;

-- Bulk edit: p_operations = [{"action": "add" | "remove", "value_id": 12}, ...]
create or replace function public.bulk_edit_content_ideas(p_ids bigint[], p_operations jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  op jsonb;
  v_added bigint := 0;
  v_removed bigint := 0;
  n bigint;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  for op in select * from jsonb_array_elements(coalesce(p_operations, '[]'::jsonb)) loop
    if op ->> 'action' = 'add' then
      insert into public.content_idea_tags (idea_id, value_id)
      select x, (op ->> 'value_id')::bigint from unnest(p_ids) as x
      on conflict do nothing;
      get diagnostics n = row_count; v_added := v_added + n;
    elsif op ->> 'action' = 'remove' then
      delete from public.content_idea_tags where idea_id = any (p_ids) and value_id = (op ->> 'value_id')::bigint;
      get diagnostics n = row_count; v_removed := v_removed + n;
    end if;
  end loop;
  update public.content_ideas set updated_at = now() where id = any (p_ids);
  return jsonb_build_object('links_added', v_added, 'links_removed', v_removed);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. CSV import (the browser parses and checks the file, then sends rows in batches)
--    Each row: {"_row": 2, "external_id": "...", "published_at": "...", "embed": "...", "url": "...", "title": "...",
--               "sport": "Football", "competition": "LaLiga,Champions League", "club": "...", ...}
--    An existing idea with the same external_id is deleted and recreated (backup kept for revert).
-- ---------------------------------------------------------------------------
create or replace function public.import_content_ideas_batch(p_import_id bigint, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r jsonb;
  cat text;
  part text;
  v_old public.content_ideas%rowtype;
  v_id bigint;
  v_value bigint;
  v_created int := 0;
  v_replaced int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_ext text;
  cats text[] := array['trend', 'sport', 'entity', 'competition', 'club', 'format', 'platform', 'campaign'];
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if not exists (select 1 from public.idea_imports where id = p_import_id) then raise exception 'Import % not found', p_import_id; end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_ext := nullif(trim(r ->> 'external_id'), '');
    begin
      if v_ext is null then raise exception 'Missing external_id'; end if;

      select * into v_old from public.content_ideas where external_id = v_ext;
      if found then
        insert into public.idea_import_backups (import_id, external_id, data)
        values (p_import_id, v_ext, to_jsonb(v_old) || jsonb_build_object(
          'value_ids', coalesce((select jsonb_agg(value_id) from public.content_idea_tags where idea_id = v_old.id), '[]'::jsonb)))
        on conflict (import_id, external_id) do nothing;
        delete from public.content_ideas where id = v_old.id;
        v_replaced := v_replaced + 1;
      end if;

      insert into public.content_ideas (external_id, title, published_at, embed, url, import_id)
      values (v_ext, nullif(r ->> 'title', ''), nullif(r ->> 'published_at', '')::timestamptz,
              nullif(r ->> 'embed', ''), nullif(r ->> 'url', ''), p_import_id)
      returning id into v_id;

      foreach cat in array cats loop
        for part in select trim(x) from regexp_split_to_table(coalesce(r ->> cat, ''), ',') as x loop
          continue when part = '';
          v_value := null;
          select id into v_value from public.idea_catalog where category = cat and lower(name) = lower(part) order by id limit 1;
          if v_value is null then
            v_value := public.catalog_value_id(cat, part);
            v_new := jsonb_set(v_new, array[cat], coalesce(v_new -> cat, '[]'::jsonb) || to_jsonb(part));
          end if;
          insert into public.content_idea_tags (idea_id, value_id) values (v_id, v_value) on conflict do nothing;
        end loop;
      end loop;

      v_created := v_created + 1;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', r -> '_row', 'external_id', v_ext, 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('created', v_created, 'replaced', v_replaced, 'errors', v_errors, 'new_values_created', v_new);
end;
$$;

-- Undo an import: delete the ideas it created and restore the ideas it replaced.
create or replace function public.revert_content_import(p_import_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  b record;
  v_id bigint;
  v_deleted int;
  v_restored int := 0;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if not exists (select 1 from public.idea_imports where id = p_import_id and status in ('completed', 'failed')) then
    raise exception 'Only completed imports can be reverted';
  end if;

  delete from public.content_ideas where import_id = p_import_id;
  get diagnostics v_deleted = row_count;

  for b in select * from public.idea_import_backups where import_id = p_import_id loop
    continue when exists (select 1 from public.content_ideas where external_id = b.external_id);
    insert into public.content_ideas (external_id, title, published_at, embed, url, import_id, created_at)
    values (b.external_id, b.data ->> 'title', (b.data ->> 'published_at')::timestamptz, b.data ->> 'embed',
            b.data ->> 'url', nullif(b.data ->> 'import_id', '')::bigint, coalesce((b.data ->> 'created_at')::timestamptz, now()))
    returning id into v_id;
    insert into public.content_idea_tags (idea_id, value_id)
    select v_id, x::bigint from jsonb_array_elements_text(coalesce(b.data -> 'value_ids', '[]'::jsonb)) as x
    where exists (select 1 from public.idea_catalog where id = x::bigint)
    on conflict do nothing;
    v_restored := v_restored + 1;
  end loop;

  delete from public.idea_import_backups where import_id = p_import_id;
  update public.idea_imports set status = 'reverted', reverted_at = now() where id = p_import_id;
  return jsonb_build_object('deleted', v_deleted, 'restored', v_restored);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Storage bucket for the original CSV files (private, admins only)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

drop policy if exists "Admins read import files" on storage.objects;
create policy "Admins read import files" on storage.objects for select to authenticated
  using (bucket_id = 'imports' and public.is_admin());

drop policy if exists "Admins upload import files" on storage.objects;
create policy "Admins upload import files" on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and public.is_admin());

drop policy if exists "Admins delete import files" on storage.objects;
create policy "Admins delete import files" on storage.objects for delete to authenticated
  using (bucket_id = 'imports' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. Admin users: superadmins can grant / remove admin access by email
-- ---------------------------------------------------------------------------
create or replace function public.set_admin_role(p_email text, p_role text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if public.current_role_name() <> 'superadmin' then raise exception 'Only superadmins can change admin access'; end if;
  if p_role not in ('user', 'admin', 'superadmin') then raise exception 'Unknown role %', p_role; end if;
  select * into v_profile from public.profiles where lower(email) = lower(trim(p_email));
  if not found then return jsonb_build_object('found', false); end if;
  if v_profile.id = auth.uid() then raise exception 'You cannot change your own role'; end if;
  update public.profiles set role = p_role where id = v_profile.id;
  return jsonb_build_object('found', true, 'id', v_profile.id, 'role', p_role);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Function permissions: signed-in users only (each function also checks is_admin / RLS)
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.filter_content_ideas(jsonb, text, text, date, date)',
    'public.content_idea_tag_map(bigint)',
    'public.search_content_ideas(jsonb, text, text, date, date, int, int)',
    'public.search_content_idea_ids(jsonb, text, text, date, date)',
    'public.content_ideas_by_ids(bigint[])',
    'public.available_filter_counts(jsonb, text, text, date, date)',
    'public.catalog_with_counts()',
    'public.catalog_category_totals()',
    'public.catalog_value_id(text, text)',
    'public.save_content_idea(bigint, jsonb, bigint[])',
    'public.bulk_edit_content_ideas(bigint[], jsonb)',
    'public.import_content_ideas_batch(bigint, jsonb)',
    'public.revert_content_import(bigint)',
    'public.set_admin_role(text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
