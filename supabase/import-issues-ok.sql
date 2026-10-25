-- Import cover issues can be marked as seen (Admin → Import → an import → Issues → "OK" / "Mark all as seen"):
-- a seen post leaves the issues list and the import's "N without cover" warning (idea_imports.cover_issues) counts
-- only the ones not seen yet. Run once in Supabase > SQL editor (after supabase/import-autopublish.sql). Safe to run again.

alter table public.content_ideas add column if not exists cover_issue_ok_at timestamptz;

-- p_ids: the posts to mark; null = every issue of the import. Returns the issues left.
create or replace function public.admin_import_issues_ok(p_import_id bigint, p_ids bigint[] default null)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.content_ideas set cover_issue_ok_at = now()
    where import_id = p_import_id and cover_url is null and cover_issue_ok_at is null and (p_ids is null or id = any (p_ids));
  select count(*) into n from public.content_ideas where import_id = p_import_id and cover_url is null and cover_issue_ok_at is null;
  update public.idea_imports set cover_issues = n where id = p_import_id and cover_issues is not null;
  return n;
end $$;

create or replace function public.admin_import_approve(p_import_id bigint)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  delete from public.content_hidden h using public.content_ideas c
    where c.import_id = p_import_id and h.external_id = c.external_id
      and not exists (select 1 from public.content_removals r where r.external_id = c.external_id);
  get diagnostics n = row_count;
  update public.idea_imports set review_status = 'approved', approved_at = now(), approved_by = auth.uid(),
      cover_issues = (select count(*) from public.content_ideas where import_id = p_import_id and cover_url is null and cover_issue_ok_at is null)
    where id = p_import_id;
  delete from public.library_total_cache where true;   -- "where true": the API refuses a DELETE without WHERE
  return n;
end $$;

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
      -- the posts with an issue (no cover after trying) not marked as seen yet, to check them by hand
      'issues_n', count(*) filter (where c.cover_url is null and (c.cover_at is not null or c.unavailable_at is not null) and c.cover_issue_ok_at is null),
      'issues', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'url', i.url, 'removed', i.unavailable_at is not null)) from (select id, url, unavailable_at from public.content_ideas
          where import_id = p_import_id and cover_url is null and (cover_at is not null or unavailable_at is not null) and cover_issue_ok_at is null order by id limit 100) i), '[]'::jsonb),
      'status', (select review_status from public.idea_imports where id = p_import_id))
    from public.content_ideas c where c.import_id = p_import_id);
end $$;
