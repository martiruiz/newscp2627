-- Facebook embeds: the real height of each post's embed drawn at Facebook's 500 px width (header, text, pictures and
-- counts), measured once in a headless browser (pipeline/library/fb_measure.py), so each card in the Content Library
-- (js/library.js, Facebook only) takes the post's exact size. 0 = could not be measured (the card keeps its estimate).
alter table public.content_ideas add column if not exists embed_h smallint;
drop index if exists public.content_ideas_fb_embed_todo_idx;   -- the order fb_measure.py reads them in (nulls last)
create index content_ideas_fb_embed_todo_idx on public.content_ideas (published_at desc nulls last)
  where account_platform = 'facebook' and embed_h is null and unavailable_at is null;

create or replace function public.apply_fb_embed_h(p_rows jsonb)
returns int language sql security definer set search_path = public as $$
  with u as (
    update public.content_ideas c set embed_h = (r ->> 'h')::smallint
    from jsonb_array_elements(p_rows) r where c.id = (r ->> 'id')::bigint
    returning 1)
  select count(*)::int from u;
$$;
revoke all on function public.apply_fb_embed_h(jsonb) from public, anon, authenticated;
