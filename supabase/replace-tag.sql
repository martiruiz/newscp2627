-- Admin → Content ideas → "Change tag": every post with tag A gets tag B instead, in one step (all of them, or only the
-- posts of the current filters: p_ids). Used to merge duplicates (Celta → RC Celta de Vigo) or move posts to the right
-- value. The old value stays in the catalog (Admin → Filters), with no posts left when it was all of them.
create or replace function public.replace_tag(p_from bigint, p_to bigint, p_ids bigint[] default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare moved bigint; had bigint;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_from is null or p_to is null or p_from = p_to then raise exception 'Pick two different tags'; end if;
  if not exists (select 1 from public.idea_catalog where id = p_to) then raise exception 'The new tag does not exist'; end if;
  create temp table _rt on commit drop as
    select idea_id from public.content_idea_tags where value_id = p_from and (p_ids is null or idea_id = any (p_ids));
  get diagnostics moved = row_count;
  insert into public.content_idea_tags (idea_id, value_id, source) select idea_id, p_to, 'admin' from _rt on conflict do nothing;
  get diagnostics had = row_count;   -- links created (the rest already had the new tag)
  delete from public.content_idea_tags t using _rt where t.value_id = p_from and t.idea_id = _rt.idea_id;
  update public.content_ideas c set updated_at = now() from _rt where c.id = _rt.idea_id;
  delete from public.library_total_cache where true;   -- cached library totals: counted again
  return jsonb_build_object('posts', moved, 'added', had, 'left_on_old', (select count(*) from public.content_idea_tags where value_id = p_from));
end $$;
revoke execute on function public.replace_tag(bigint, bigint, bigint[]) from public, anon;
grant execute on function public.replace_tag(bigint, bigint, bigint[]) to authenticated;

-- how many posts have a tag (all, or among p_ids), for the preview
create or replace function public.tag_post_count(p_value bigint, p_ids bigint[] default null)
returns bigint language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then (select count(*) from public.content_idea_tags where value_id = p_value and (p_ids is null or idea_id = any (p_ids))) end;
$$;
revoke execute on function public.tag_post_count(bigint, bigint[]) from public, anon;
grant execute on function public.tag_post_count(bigint, bigint[]) to authenticated;
