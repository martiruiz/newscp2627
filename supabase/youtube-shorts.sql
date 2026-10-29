-- YouTube Shorts shown as Shorts (vertical) instead of horizontal videos. Every YouTube post came with the plain
-- watch?v= link, so the library took them all for horizontal videos.
-- Checked on 29/10 for the 21,782 YouTube posts, with no API key:
--   · 9,479 have YouTube's vertical still (i.ytimg.com/vi/ID/oardefault.jpg), which only Shorts have        → kind 'vert'
--   · 1,529 more don't, but their thumbnail is a Short's (the vertical frame in the middle, the sides blurred) → kind 'thumb'
--   · 128 couldn't be checked (no thumbnail: probably deleted)                                               → kind 'err', left as they are
--   · the other 10,646 are horizontal videos
-- The ids are in public._yt_shorts (filled already). This applies it, then drops that table. Run once in the SQL Editor.
begin;

with sh as (select s.id, s.kind, (regexp_match(c.url, '(?:shorts/|v=|youtu\.be/|embed/)([A-Za-z0-9_-]{11})'))[1] yt
            from public._yt_shorts s join public.content_ideas c on c.id = s.id where s.kind in ('vert', 'thumb'))
-- Shorts: their /shorts/ link; the vertical still as cover when YouTube has it
update public.content_ideas c set url = 'https://www.youtube.com/shorts/' || sh.yt,
    cover_url = case when sh.kind = 'vert' then 'https://i.ytimg.com/vi/' || sh.yt || '/oardefault.jpg'
                     else coalesce(c.cover_url, 'https://i.ytimg.com/vi/' || sh.yt || '/hqdefault.jpg') end,
    cover_at = coalesce(c.cover_at, now())
  from sh where c.id = sh.id and sh.yt is not null;

-- their format: Shorts, not Video
delete from public.content_idea_tags t using public._yt_shorts s
  where t.idea_id = s.id and s.kind in ('vert', 'thumb') and t.value_id = (select id from public.idea_catalog where category = 'format' and name = 'Video');
insert into public.content_idea_tags (idea_id, value_id)
  select s.id, (select id from public.idea_catalog where category = 'format' and name = 'Shorts') from public._yt_shorts s where s.kind in ('vert', 'thumb')
  on conflict do nothing;

-- the horizontal videos the Excel had tagged Shorts: Video instead
with nv as (select c.id from public.content_ideas c
            where (c.url ilike '%youtube.com%' or c.url ilike '%youtu.be%') and c.url not ilike '%/shorts/%'
              and not exists (select 1 from public._yt_shorts s where s.id = c.id)),
     d as (delete from public.content_idea_tags t using nv
           where t.idea_id = nv.id and t.value_id = (select id from public.idea_catalog where category = 'format' and name = 'Shorts')
           returning t.idea_id)
insert into public.content_idea_tags (idea_id, value_id)
  select idea_id, (select id from public.idea_catalog where category = 'format' and name = 'Video') from d on conflict do nothing;

drop table public._yt_shorts;
commit;

select public.refresh_library_stats('values');   -- the filters' counts (Shorts / Video) right away
