-- Content Library ← imported content (content_ideas). Run after supabase/admin.sql. Safe to re-run.
-- Members (any signed-in user) can READ ideas, their tags and the filter values.
-- Only superadmins can create / edit / delete them (existing "Admins manage …" policies).

drop policy if exists "Members read ideas" on public.content_ideas;
create policy "Members read ideas" on public.content_ideas for select to authenticated using (true);
drop policy if exists "Members read idea tags" on public.content_idea_tags;
create policy "Members read idea tags" on public.content_idea_tags for select to authenticated using (true);
drop policy if exists "Members read catalog" on public.idea_catalog;
create policy "Members read catalog" on public.idea_catalog for select to authenticated using (true);

-- One page of ideas for the Content Library.
--   p_filters: {"sport": {"ids": [1, 2]}, "club": {"ids": [7]}}  → any value within a category, every category must match
--   p_order:   'latest' | 'random' (stable per p_seed so "Load more" doesn't repeat posts)
--   p_ids:     restrict to these ideas (saved posts / a folder)
create or replace function public.library_ideas(
  p_filters  jsonb    default '{}'::jsonb,
  p_q        text     default null,
  p_from     date     default null,
  p_to       date     default null,
  p_order    text     default 'latest',
  p_seed     text     default '',
  p_ids      bigint[] default null,
  p_limit    int      default 24,
  p_offset   int      default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with m as (
    select c.* from public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c
    where p_ids is null or c.id = any (p_ids)
  ),
  page as (
    select * from m
    order by
      case when p_order = 'random' then md5(m.id::text || coalesce(p_seed, '')) end,
      m.published_at desc nulls last, m.id desc
    limit least(greatest(coalesce(p_limit, 24), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from m),
    'data', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'external_id', p.external_id, 'title', p.title, 'published_at', p.published_at,
        'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id)
      ) order by
        case when p_order = 'random' then md5(p.id::text || coalesce(p_seed, '')) end,
        p.published_at desc nulls last, p.id desc)
      from page p), '[]'::jsonb)
  );
$$;
revoke execute on function public.library_ideas(jsonb, text, date, date, text, text, bigint[], int, int) from public, anon;
grant execute on function public.library_ideas(jsonb, text, date, date, text, text, bigint[], int, int) to authenticated;

-- Folders can now hold imported ideas too (saved as 'ci-<id>'), so post_id no longer has to exist in public.posts.
alter table public.folder_items drop constraint if exists folder_items_post_id_fkey;
