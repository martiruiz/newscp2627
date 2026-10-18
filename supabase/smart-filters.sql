-- Smart filters: new filter categories, Instagram data (exact format, size, duration, views), AI labels, and a clean-up of
-- the imported formats. Run after performance-5.sql and smart-review.sql. Safe to re-run.
--
-- Format clean-up (only Instagram can be "Reel"):
--   • "Post" (Facebook posts with an image) → "Images"     • "carousel" → "Carousel"
--   • "Reel" on Facebook / TikTok → "Video"                  • Instagram formats are corrected post by post from
--                                                              Instagram's own data (pipeline/library/smart-classify.mjs)

-- ---------- 1. Categories ----------
alter table public.idea_catalog drop constraint if exists idea_catalog_category_check;
alter table public.idea_catalog add constraint idea_catalog_category_check check (category in (
  'trend', 'sport', 'entity', 'competition', 'club', 'format', 'platform', 'campaign',
  'moment', 'matchday_graphic', 'kit', 'transfer', 'outcome', 'season_moment', 'opponent', 'city',
  'goal', 'comms', 'crisis', 'team', 'angle', 'collab', 'cta',
  'sponsor', 'sponsor_sector', 'sponsor_integration', 'language',
  'aspect_ratio', 'duration'));

-- Where each tag comes from: the import file, the AI, Instagram's data, or an admin
alter table public.content_idea_tags add column if not exists source text not null default 'import';
alter table public.content_idea_tags drop constraint if exists content_idea_tags_source_check;
alter table public.content_idea_tags add constraint content_idea_tags_source_check check (source in ('import', 'ai', 'meta', 'admin'));

-- ---------- 2. Instagram data + AI labels on each post ----------
alter table public.content_ideas add column if not exists media_type text check (media_type in ('image', 'carousel', 'reel', 'video'));
alter table public.content_ideas add column if not exists media_width int;
alter table public.content_ideas add column if not exists media_height int;
alter table public.content_ideas add column if not exists duration_s numeric(8, 2);
alter table public.content_ideas add column if not exists views bigint;
alter table public.content_ideas add column if not exists meta_at timestamptz;       -- when Instagram's data was read
alter table public.content_ideas add column if not exists smart jsonb;               -- raw AI labels (re-usable without new cost)
alter table public.content_ideas add column if not exists smart_at timestamptz;      -- when the AI labelled it
alter table public.content_ideas add column if not exists smart_version text;
create index if not exists content_ideas_views_idx on public.content_ideas (views desc nulls last, id desc) where views is not null and unavailable_at is null;
create index if not exists content_ideas_smart_idx on public.content_ideas (smart_at) where smart_at is not null;

-- Proportion name from a size (closest standard ratio)
create or replace function public.aspect_name(p_w int, p_h int)
returns text language sql immutable as $$
  select case when coalesce(p_w, 0) <= 0 or coalesce(p_h, 0) <= 0 then null else (
    select name from (values ('1:1', 1.0), ('4:5', 0.8), ('3:4', 0.75), ('9:16', 0.5625), ('16:9', 1.7778), ('1.91:1', 1.91), ('2:3', 0.6667), ('4:3', 1.3333))
      v(name, r) order by abs(ln(p_w::numeric / p_h) - ln(r)) limit 1) end;
$$;
create or replace function public.duration_name(p_s numeric)
returns text language sql immutable as $$
  select case when p_s is null then null when p_s < 15 then 'Under 15s' when p_s < 30 then '15–30s' when p_s < 60 then '30–60s' else 'Over 60s' end;
$$;

-- Replace one category's tags of a post (from a given source)
create or replace function public.set_idea_tags(p_idea bigint, p_category text, p_names text[], p_source text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.content_idea_tags t using public.idea_catalog v
  where t.idea_id = p_idea and v.id = t.value_id and v.category = p_category
    and (t.source = p_source or (p_category = 'format' and p_source = 'meta'));
  insert into public.content_idea_tags (idea_id, value_id, source)
  select p_idea, public.catalog_value_id(p_category, n), p_source
  from unnest(coalesce(p_names, '{}')) n where nullif(trim(n), '') is not null
  on conflict (idea_id, value_id) do nothing;
end $$;

-- Instagram data for many posts: [{id, media_type, width, height, duration, views}]  (service role only)
create or replace function public.apply_ig_meta(p_rows jsonb)
returns int language plpgsql volatile security definer set search_path = public as $$
declare r jsonb; n int := 0; fmt text;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    update public.content_ideas set
      media_type = r ->> 'media_type', media_width = (r ->> 'width')::int, media_height = (r ->> 'height')::int,
      duration_s = (r ->> 'duration')::numeric, views = (r ->> 'views')::bigint, meta_at = now(),
      media_ratio = case when (r ->> 'width')::int > 0 then round((r ->> 'height')::numeric / (r ->> 'width')::numeric, 4) else media_ratio end
    where id = (r ->> 'id')::bigint;
    fmt := case r ->> 'media_type' when 'image' then 'Images' when 'carousel' then 'Carousel' when 'reel' then 'Reel' when 'video' then 'Video' end;
    if fmt is not null then perform public.set_idea_tags((r ->> 'id')::bigint, 'format', array[fmt], 'meta'); end if;
    perform public.set_idea_tags((r ->> 'id')::bigint, 'aspect_ratio', array_remove(array[public.aspect_name((r ->> 'width')::int, (r ->> 'height')::int)], null), 'meta');
    perform public.set_idea_tags((r ->> 'id')::bigint, 'duration', array_remove(array[public.duration_name((r ->> 'duration')::numeric)], null), 'meta');
    n := n + 1;
  end loop;
  return n;
end $$;

-- AI labels for many posts: [{id, labels: {category: [names]}, version}]  (service role only)
create or replace function public.apply_smart_labels(p_rows jsonb)
returns int language plpgsql volatile security definer set search_path = public as $$
declare r jsonb; c record; n int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    for c in select key, value from jsonb_each(r -> 'labels') loop
      perform public.set_idea_tags((r ->> 'id')::bigint, c.key,
        case jsonb_typeof(c.value) when 'array' then array(select jsonb_array_elements_text(c.value)) when 'string' then array[c.value #>> '{}'] else '{}' end, 'ai');
    end loop;
    update public.content_ideas set smart = r -> 'labels', smart_at = now(), smart_version = r ->> 'version' where id = (r ->> 'id')::bigint;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.set_idea_tags(bigint, text, text[], text) from public, anon, authenticated;
revoke execute on function public.apply_ig_meta(jsonb) from public, anon;
revoke execute on function public.apply_smart_labels(jsonb) from public, anon;

-- ---------- 3. Format clean-up ----------
do $$
declare v_images bigint; v_post bigint; v_video bigint; v_reel bigint; v_car bigint; v_car2 bigint;
begin
  v_images := public.catalog_value_id('format', 'Images');
  select id into v_post from public.idea_catalog where category = 'format' and name = 'Post';
  if v_post is not null then
    insert into public.content_idea_tags (idea_id, value_id) select idea_id, v_images from public.content_idea_tags where value_id = v_post on conflict do nothing;
    delete from public.idea_catalog where id = v_post;   -- its tags go with it
  end if;
  -- "carousel" → "Carousel"
  select id into v_car from public.idea_catalog where category = 'format' and name = 'carousel';
  select id into v_car2 from public.idea_catalog where category = 'format' and name = 'Carousel';
  if v_car is not null and v_car2 is null then
    update public.idea_catalog set name = 'Carousel' where id = v_car;
  elsif v_car is not null and v_car2 is not null then
    insert into public.content_idea_tags (idea_id, value_id) select idea_id, v_car2 from public.content_idea_tags where value_id = v_car on conflict do nothing;
    delete from public.idea_catalog where id = v_car;
  end if;
  -- Reel only on Instagram
  select id into v_reel from public.idea_catalog where category = 'format' and name = 'Reel';
  v_video := public.catalog_value_id('format', 'Video');
  if v_reel is not null then
    with moved as (
      delete from public.content_idea_tags t
      where t.value_id = v_reel and exists (
        select 1 from public.content_idea_tags p join public.idea_catalog v on v.id = p.value_id
        where p.idea_id = t.idea_id and v.category = 'platform' and v.name in ('Facebook', 'TikTok'))
      returning t.idea_id)
    insert into public.content_idea_tags (idea_id, value_id) select idea_id, v_video from moved on conflict do nothing;
  end if;
end $$;

-- Import: the same rules for future files (used by import_content_ideas_batch through catalog_value_id)
create or replace function public.normalize_format_name(p_name text, p_platform text)
returns text language sql immutable as $$
  select case
    when lower(p_name) in ('post', 'image', 'images', 'photo') then 'Images'
    when lower(p_name) = 'carousel' then 'Carousel'
    when lower(p_name) in ('reel', 'reels') and lower(coalesce(p_platform, 'instagram')) <> 'instagram' then 'Video'
    when lower(p_name) in ('reel', 'reels') then 'Reel'
    when lower(p_name) in ('short', 'shorts') then 'Shorts'
    when lower(p_name) = 'video' then 'Video'
    else p_name end;
$$;
