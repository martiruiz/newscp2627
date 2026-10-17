-- Admin → Import: delete imports from the history. Run after supabase/admin.sql. Safe to re-run.
--   p_with_posts = true  → first undo the import (its posts are deleted, the posts it replaced are restored — same as
--                          "Revert"), then remove it from the history.
--   p_with_posts = false → remove it from the history only; its posts stay in the library.
-- The stored CSV file is deleted by the admin page (Storage bucket "imports").
create or replace function public.delete_content_import(p_import_id bigint, p_with_posts boolean default true)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare imp record; res jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select id, status, file_path into imp from public.idea_imports where id = p_import_id;
  if not found then raise exception 'Import not found'; end if;
  if p_with_posts and imp.status in ('completed', 'failed', 'importing')
     and exists (select 1 from public.content_ideas where import_id = p_import_id
                 union all select 1 from public.idea_import_backups where import_id = p_import_id) then
    -- an import stuck in "importing" is treated as failed so it can be undone
    update public.idea_imports set status = 'failed' where id = p_import_id and status = 'importing';
    res := public.revert_content_import(p_import_id);
  end if;
  delete from public.idea_imports where id = p_import_id;   -- backups cascade; kept posts lose the link (import_id → null)
  return res || jsonb_build_object('file_path', imp.file_path);
end $$;
revoke execute on function public.delete_content_import(bigint, boolean) from public, anon;
grant execute on function public.delete_content_import(bigint, boolean) to authenticated;
