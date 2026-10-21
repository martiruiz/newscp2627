-- Imports wait for a review before members see them (Admin → Import):
--   1. the import ends → its posts are hidden from members (content_hidden, the same list removed posts use; admins still
--      see them) and the import is "pending review";
--   2. the importer loads the covers (Edge Function "covers") with a progress bar;
--   3. "Approve and publish" → the posts leave content_hidden (unless they were removed on purpose) and members see them.
-- Imports made before this file count as approved. Run once in Supabase > SQL editor (after admin.sql and
-- performance.sql). Safe to run again.

alter table public.idea_imports add column if not exists review_status text check (review_status in ('pending', 'approved'));
alter table public.idea_imports add column if not exists approved_at timestamptz;
alter table public.idea_imports add column if not exists approved_by uuid references auth.users (id) on delete set null;
update public.idea_imports set review_status = 'approved', approved_at = coalesce(completed_at, created_at) where review_status is null;

-- the import just ended: hide its posts until they are approved
create or replace function public.admin_import_hold(p_import_id bigint)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  insert into public.content_hidden (external_id)
    select external_id from public.content_ideas where import_id = p_import_id
  on conflict do nothing;
  get diagnostics n = row_count;
  update public.idea_imports set review_status = 'pending', approved_at = null, approved_by = null where id = p_import_id;
  return n;
end $$;

-- covers of an import: how many posts, with a cover, without one (no image available) and still to do;
-- p_todo: the ids still to do (for the importer to send to the Edge Function)
create or replace function public.admin_import_covers(p_import_id bigint, p_todo int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return (select jsonb_build_object(
      'total', count(*),
      'with_cover', count(*) filter (where c.cover_url is not null),
      'no_image', count(*) filter (where c.cover_url is null and c.cover_at is not null and c.unavailable_at is null),
      'removed', count(*) filter (where c.unavailable_at is not null),
      'todo', count(*) filter (where c.cover_url is null and c.cover_at is null and c.unavailable_at is null),
      'todo_ids', coalesce((select jsonb_agg(x.id) from (select id from public.content_ideas
          where import_id = p_import_id and cover_url is null and cover_at is null and unavailable_at is null order by id limit greatest(p_todo, 0)) x), '[]'::jsonb),
      'sample', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'cover', s.cover_url, 'url', s.url)) from (select id, cover_url, url from public.content_ideas
          where import_id = p_import_id and cover_url is not null order by id desc limit 24) s), '[]'::jsonb),
      'status', (select review_status from public.idea_imports where id = p_import_id))
    from public.content_ideas c where c.import_id = p_import_id);
end $$;

-- approve: members see the posts (removed posts stay hidden)
create or replace function public.admin_import_approve(p_import_id bigint)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  delete from public.content_hidden h using public.content_ideas c
    where c.import_id = p_import_id and h.external_id = c.external_id
      and not exists (select 1 from public.content_removals r where r.external_id = c.external_id);
  get diagnostics n = row_count;
  update public.idea_imports set review_status = 'approved', approved_at = now(), approved_by = auth.uid() where id = p_import_id;
  delete from public.library_total_cache where true;   -- "where true": the API refuses a DELETE without WHERE
  return n;
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_import_hold(bigint)', 'admin_import_covers(bigint, int)', 'admin_import_approve(bigint)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
