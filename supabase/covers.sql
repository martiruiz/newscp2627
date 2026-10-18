-- Covers: a clean cover image for every post (stored in Supabase Storage, bucket "covers"), so the Content Library shows
-- tidy cards instead of 24 embedded pages. Filled by pipeline/library/covers.mjs (all platforms) and by
-- smart-classify.mjs --prepare (Instagram). Run after smart-filters.sql. Safe to re-run.

alter table public.content_ideas add column if not exists cover_url text;
alter table public.content_ideas add column if not exists cover_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Anyone reads covers" on storage.objects;
create policy "Anyone reads covers" on storage.objects for select using (bucket_id = 'covers');
-- (covers are written by the pipeline with the service role, which bypasses these policies)

-- The library page returns the cover, the media type, the duration and the views of each post
create or replace function public.library_ideas(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null,
  p_order text default 'latest', p_seed text default '', p_ids bigint[] default null, p_limit int default 24, p_offset int default 0,
  p_boost bigint[] default null, p_boost2 bigint[] default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  lim int := least(greatest(coalesce(p_limit, 24), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := nullif(trim(p_q), '');
  tagged boolean := public.has_tag_filters(p_filters);
  only_tags boolean := q is null and p_from is null and p_to is null and p_ids is null;
  est bigint;
  small boolean := false;
  k int := 1;
  r int := 0;
  v_total bigint;
  v_data jsonb;
begin
  est := case when tagged then coalesce(public.tag_filter_estimate(p_filters), 0)
              else (select n from public.library_totals where key = 'library') end;
  small := tagged and est <= 20000;
  -- "Surprise me" on a big selection: shuffle 1 post in every k (k and the offset r depend on the seed)
  if p_order = 'random' and not small and p_ids is null then
    k := public.shuffle_step(est);
    r := (abs(hashtext(coalesce(p_seed, ''))) % k)::int;
  end if;

  -- Total (always the whole selection)
  if only_tags then
    v_total := public.tag_filter_total(p_filters);
  elsif small then
    select count(*) into v_total from public.content_ideas c
    where c.id in (select public.ideas_matching_tags(p_filters))
      and c.unavailable_at is null
      and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
      and (q is null or c.title ilike '%' || q || '%')
      and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
      and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
      and (p_ids is null or c.id = any (p_ids));
  else
    select count(*) into v_total from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
    where c.unavailable_at is null
      and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
      and (p_ids is null or c.id = any (p_ids));
  end if;

  -- Page
  if small then
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio, c.cover_url, c.media_type, c.duration_s, c.views,
        case when p_order = 'foryou' then
          case when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost, '{}'))) then 0
               when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost2, '{}'))) then 1
               else 2 end end as k_rank,
        case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as k_shuffle
      from public.content_ideas c
      where c.id in (select public.ideas_matching_tags(p_filters))
        and c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
        and (q is null or c.title ilike '%' || q || '%')
        and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
        and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
        and (p_ids is null or c.id = any (p_ids))
      order by k_rank nulls last, k_shuffle nulls last, c.published_at desc nulls last, c.id desc
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'cover_url', p.cover_url, 'media_type', p.media_type, 'duration_s', p.duration_s, 'views', p.views) order by p.k_rank nulls last, p.k_shuffle nulls last, p.published_at desc nulls last, p.id desc), '[]'::jsonb)
    into v_data from page p;
  elsif k > 1 then
    -- big selection, "Surprise me": 1 post in every k (the filters are checked only on those)
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio, c.cover_url, c.media_type, c.duration_s, c.views, md5(c.id::text || coalesce(p_seed, '')) as k_shuffle
      from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
      where c.id % k = r
        and c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
      order by k_shuffle
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'cover_url', p.cover_url, 'media_type', p.media_type, 'duration_s', p.duration_s, 'views', p.views) order by p.k_shuffle), '[]'::jsonb)
    into v_data from page p;
  else
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio, c.cover_url, c.media_type, c.duration_s, c.views,
        case when p_order = 'foryou' then
          case when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost, '{}'))) then 0
               when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost2, '{}'))) then 1
               else 2 end end as k_rank,
        case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as k_shuffle
      from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
      where c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
        and (p_ids is null or c.id = any (p_ids))
      order by k_rank nulls last, k_shuffle nulls last, c.published_at desc nulls last, c.id desc
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'cover_url', p.cover_url, 'media_type', p.media_type, 'duration_s', p.duration_s, 'views', p.views) order by p.k_rank nulls last, p.k_shuffle nulls last, p.published_at desc nulls last, p.id desc), '[]'::jsonb)
    into v_data from page p;
  end if;

  return jsonb_build_object('total', v_total, 'data', v_data);
end $$;

