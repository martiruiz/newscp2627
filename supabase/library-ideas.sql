-- Content Library ← imported content (content_ideas). Run after supabase/admin.sql. Safe to re-run.
-- Members (any signed-in user) can READ ideas, their tags and the filter values.
-- Only superadmins can create / edit / delete them (existing "Admins manage …" policies).

drop policy if exists "Members read ideas" on public.content_ideas;
create policy "Members read ideas" on public.content_ideas for select to authenticated using (true);
drop policy if exists "Members read idea tags" on public.content_idea_tags;
create policy "Members read idea tags" on public.content_idea_tags for select to authenticated using (true);
drop policy if exists "Members read catalog" on public.idea_catalog;
create policy "Members read catalog" on public.idea_catalog for select to authenticated using (true);

-- Posts that no longer exist on the platform (deleted / private). Set by pipeline/library/check-embeds.mjs.
-- They are hidden from the Content Library; superadmins can delete them from Admin → Content Ideas.
alter table public.content_ideas add column if not exists unavailable_at timestamptz;
alter table public.content_ideas add column if not exists checked_at     timestamptz;
-- Media shape (height / width of the post as Instagram shows it: 1.25 = 4:5, 1.333 = 3:4, 0.5625 = 16:9). Set by check-embeds.mjs.
alter table public.content_ideas add column if not exists media_ratio numeric;
-- Deep analysis (hook, why it works, format, angle, visual breakdown…). Written by pipeline/library/analysis.mjs.
alter table public.content_ideas add column if not exists analysis    jsonb;
alter table public.content_ideas add column if not exists analyzed_at timestamptz;
create index if not exists content_ideas_unavailable_idx on public.content_ideas (unavailable_at) where unavailable_at is not null;

-- One page of ideas for the Content Library (unavailable posts excluded).
--   p_filters: {"sport": {"ids": [1, 2]}, "club": {"ids": [7]}}  → any value within a category, every category must match
--   p_order:   'latest' | 'random' (stable per p_seed so "Load more" doesn't repeat posts)
--              | 'foryou': posts tagged with p_boost (favourite profiles / creators) first, then p_boost2 (their sports /
--                competitions), then the rest — newest first inside each group
--   p_ids:     restrict to these ideas (saved posts)
drop function if exists public.library_ideas(jsonb, text, date, date, text, text, bigint[], int, int);
create or replace function public.library_ideas(
  p_filters  jsonb    default '{}'::jsonb,
  p_q        text     default null,
  p_from     date     default null,
  p_to       date     default null,
  p_order    text     default 'latest',
  p_seed     text     default '',
  p_ids      bigint[] default null,
  p_limit    int      default 24,
  p_offset   int      default 0,
  p_boost    bigint[] default null,
  p_boost2   bigint[] default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with m as (
    select c.*,
      case when p_order = 'foryou' then
        case
          when exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_boost))  then 0
          when exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_boost2)) then 1
          else 2
        end
      end as rank,
      case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as shuffle
    from public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c
    where c.unavailable_at is null and (p_ids is null or c.id = any (p_ids))
  ),
  page as (
    select * from m
    order by rank nulls last, shuffle nulls last, published_at desc nulls last, id desc
    limit least(greatest(coalesce(p_limit, 24), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from m),
    'data', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'external_id', p.external_id, 'title', p.title, 'published_at', p.published_at,
        'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'has_analysis', p.analysis is not null
      ) order by p.rank nulls last, p.shuffle nulls last, p.published_at desc nulls last, p.id desc)
      from page p), '[]'::jsonb)
  );
$$;
revoke execute on function public.library_ideas(jsonb, text, date, date, text, text, bigint[], int, int, bigint[], bigint[]) from public, anon;
grant execute on function public.library_ideas(jsonb, text, date, date, text, text, bigint[], int, int, bigint[], bigint[]) to authenticated;

-- Filter counts for the Content Library (unavailable posts excluded).
create or replace function public.library_filter_counts(
  p_filters  jsonb default '{}'::jsonb,
  p_q        text  default null,
  p_from     date  default null,
  p_to       date  default null
)
returns table (value_id bigint, ideas bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.value_id, count(*)
  from public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c
  join public.content_idea_tags t on t.idea_id = c.id
  where c.unavailable_at is null
  group by t.value_id;
$$;
revoke execute on function public.library_filter_counts(jsonb, text, date, date) from public, anon;
grant execute on function public.library_filter_counts(jsonb, text, date, date) to authenticated;

-- Folders can now hold imported ideas too (saved as 'ci-<id>'), so post_id no longer has to exist in public.posts.
alter table public.folder_items drop constraint if exists folder_items_post_id_fkey;
