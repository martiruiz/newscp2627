-- Content Library → the filter panels (Occasion, Goal & sponsors): each option is a card with the cover of its most
-- viewed post (among its latest 3,000). value_covers(ids) → [{id, cover}] for up to 60 filter values at a time.
-- Run once in Supabase > SQL editor. Safe to run again.

create or replace function public.value_covers(p_ids bigint[])
returns table (id bigint, cover text)
language sql stable security definer set search_path = public as $$
  -- the most viewed of its latest 3,000 posts (index on (value_id, idea_id): fast even for "Football", 367k posts)
  select v.id, (
    select x.cover_url from (
      select c.cover_url, c.views from public.content_idea_tags t
      join public.content_ideas c on c.id = t.idea_id
      where t.value_id = v.id and c.cover_url is not null and c.unavailable_at is null
      order by t.idea_id desc limit 3000) x
    order by x.views desc nulls last limit 1)
  from unnest(p_ids[1:60]) as v(id);
$$;
revoke execute on function public.value_covers(bigint[]) from public, anon;
grant execute on function public.value_covers(bigint[]) to authenticated;
