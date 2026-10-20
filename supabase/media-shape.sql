-- The shape of posts whose platform doesn't give it (Facebook): read from their stored cover (pipeline/library/fb-shapes.mjs,
-- Edge Function "covers"). Saves width / height / ratio and the "Shape" filter value (9:16, 16:9, 4:5…), so
-- Facebook + Video can be filtered vertical or horizontal. Run once in Supabase > SQL editor (after smart-filters.sql).
-- Safe to run again.
create or replace function public.apply_media_shape(p_rows jsonb)   -- [{id, width, height}]
returns int language plpgsql volatile security definer set search_path = public as $$
declare r jsonb; n int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    continue when coalesce((r ->> 'width')::int, 0) <= 0 or coalesce((r ->> 'height')::int, 0) <= 0;
    update public.content_ideas set media_width = (r ->> 'width')::int, media_height = (r ->> 'height')::int,
      media_ratio = round((r ->> 'height')::numeric / (r ->> 'width')::numeric, 4)
    where id = (r ->> 'id')::bigint;
    perform public.set_idea_tags((r ->> 'id')::bigint, 'aspect_ratio', array_remove(array[public.aspect_name((r ->> 'width')::int, (r ->> 'height')::int)], null), 'meta');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.apply_media_shape(jsonb) from public, anon;
grant execute on function public.apply_media_shape(jsonb) to authenticated, service_role;
