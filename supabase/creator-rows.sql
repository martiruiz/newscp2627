-- Content Library → Content Creators on: one row per creator in the middle (photo, name, followers, recent collabs,
-- their 4 most viewed posts). creator_rows() returns them, most followed first.
--   collabs = the 4 brands (Brands / sponsor filter) most tagged on their posts
-- avatar_url: the profile picture, copied to Storage by pipeline/library/creator-avatars.mjs.
-- Run after creator-profiles.sql. Safe to run again.

alter table public.scraped_profiles add column if not exists avatar_url text;

create or replace function public.creator_rows()
returns jsonb language sql stable security definer set search_path = public as $$
  with cc as (select id from public.idea_catalog where category = 'entity' and name = 'Content Creators'),
  a as (select c.account_platform as platform, c.account as handle, count(*) as posts
    from public.content_ideas c
    where c.account is not null and c.unavailable_at is null
      and exists (select 1 from public.content_idea_tags t, cc where t.idea_id = c.id and t.value_id = cc.id)
    group by 1, 2)
  select coalesce(jsonb_agg(jsonb_build_object(
      'platform', a.platform, 'handle', a.handle, 'name', p.name, 'posts', a.posts, 'avatar', p.avatar_url,
      'followers', p.followers, 'type', p.creator_type, 'language', p.language, 'country', p.location, 'gender', p.gender,
      'collabs', (select coalesce(jsonb_agg(s.value_id), '[]'::jsonb) from (
          select t.value_id from public.content_ideas c
          join public.content_idea_tags t on t.idea_id = c.id
          join public.idea_catalog v on v.id = t.value_id and v.category = 'sponsor'
          where c.account_platform = a.platform and c.account = a.handle
          group by t.value_id order by count(*) desc limit 4) s),
      'top', (select coalesce(jsonb_agg(x.id), '[]'::jsonb) from (
          select c.id from public.content_ideas c
          where c.account_platform = a.platform and c.account = a.handle and c.unavailable_at is null and c.cover_url is not null
          order by c.views desc nulls last, c.published_at desc nulls last limit 4) x)
    ) order by p.followers desc nulls last, a.posts desc), '[]'::jsonb)
  from a left join public.scraped_profiles p on p.platform = a.platform and p.handle = a.handle;
$$;
revoke execute on function public.creator_rows() from public, anon;
grant execute on function public.creator_rows() to authenticated;
