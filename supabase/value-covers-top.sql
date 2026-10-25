-- Content Library → filter panels: up to 5 candidate covers per option (the most viewed of its latest 3,000 posts), so
-- the page can give every card a photo no other card is using (one post tagged Emotional, Argentina and Messi showed
-- on all three). value_covers_top(ids) → [{id, covers[]}] for up to 60 filter values at a time.
-- Run once in Supabase > SQL editor. Safe to run again. (value_covers stays for older pages.)

create or replace function public.value_covers_top(p_ids bigint[])
returns table (id bigint, covers text[])
language sql stable security definer set search_path = public as $$
  select v.id, (
    select array_agg(x.cover_url order by x.views desc nulls last) from (
      select y.cover_url, y.views from (
        select c.cover_url, c.views from public.content_idea_tags t
        join public.content_ideas c on c.id = t.idea_id
        where t.value_id = v.id and c.cover_url is not null and c.unavailable_at is null
        order by t.idea_id desc limit 3000) y
      order by y.views desc nulls last limit 5) x)
  from unnest(p_ids[1:60]) as v(id);
$$;
revoke execute on function public.value_covers_top(bigint[]) from public, anon;
grant execute on function public.value_covers_top(bigint[]) to authenticated;
