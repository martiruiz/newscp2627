-- A post marked "removed from the platform" (or "no image") by mistake can be recovered from Admin → Import → an import →
-- Issues: "Retry" tries its cover again (it goes back to the queue: the panel loads it); "It's active" puts it back in the
-- library as it is, without a cover (unavailable_at hides a post from the library). Run once in Supabase > SQL editor
-- (after supabase/import-issues-ok.sql). Safe to run again.

create or replace function public.admin_import_issue_retry(p_id bigint, p_keep boolean default false)
returns void language plpgsql volatile security definer set search_path = public as $$
declare imp bigint;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.content_ideas set
      unavailable_at = null,
      cover_at = case when p_keep then coalesce(cover_at, now()) else null end,
      cover_issue_ok_at = case when p_keep then now() else null end
    where id = p_id and cover_url is null
    returning import_id into imp;
  update public.idea_imports i set cover_issues = (select count(*) from public.content_ideas
      where import_id = imp and cover_url is null and cover_issue_ok_at is null)
    where i.id = imp and i.cover_issues is not null;
  delete from public.library_total_cache where true;   -- "where true": the API refuses a DELETE without WHERE
end $$;
