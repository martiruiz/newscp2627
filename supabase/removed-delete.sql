-- Admin → Content Ideas → Removed for quality: "Delete" erases removed posts for good (the post, its tags and anything
-- linked to it by cascade). The removal record stays, marked deleted_at, so the post is still blocked from future
-- imports and leaves the Removed list. Run once in Supabase > SQL editor (after supabase/quality.sql). Safe to run again.

alter table public.content_removals add column if not exists deleted_at timestamptz;

create or replace function public.delete_removed_ideas(p_external_ids text[])
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  delete from public.content_ideas c using public.content_removals r
    where r.external_id = any (p_external_ids) and c.external_id = r.external_id;
  get diagnostics n = row_count;
  update public.content_removals set deleted_at = now() where external_id = any (p_external_ids) and deleted_at is null;
  delete from public.library_total_cache where true;   -- "where true": the API refuses a DELETE without WHERE
  return n;
end $$;
revoke execute on function public.delete_removed_ideas(text[]) from public, anon;
grant execute on function public.delete_removed_ideas(text[]) to authenticated;
