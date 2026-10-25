-- Quality review: superadmins remove posts from the Content Library (e.g. low quality, off-topic, duplicates).
-- Removals are kept by external_id (the platform's post id), so a removed post doesn't come back when a new CSV
-- import contains it again. Nothing is deleted: a removal can be undone from Admin → Content Ideas.
-- Run after supabase/billing.sql. Safe to re-run.

create table if not exists public.content_removals (
  external_id  text primary key,
  post_id      bigint,                 -- last known content_ideas.id
  title        text,
  url          text,
  reason       text check (length(reason) <= 200),
  removed_by   uuid references auth.users (id) on delete set null,
  removed_at   timestamptz not null default now()
);
alter table public.content_removals enable row level security;
drop policy if exists "Admins read removals" on public.content_removals;
create policy "Admins read removals" on public.content_removals for select to authenticated using (public.is_admin());

create or replace function public.is_removed(p_external_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.content_removals where external_id = p_external_id);
$$;
grant execute on function public.is_removed(text) to authenticated;

-- Members never see removed posts (library, saved boards, planner inspiration, direct reads)
drop policy if exists "Members read ideas" on public.content_ideas;
create policy "Members read ideas" on public.content_ideas for select to authenticated
  using (public.is_admin() or not public.is_removed(external_id));

create or replace function public.remove_content_idea(p_post_id bigint, p_reason text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only superadmins can remove posts'; end if;
  insert into public.content_removals (external_id, post_id, title, url, reason, removed_by)
  select external_id, id, left(title, 300), url, nullif(trim(p_reason), ''), auth.uid() from public.content_ideas where id = p_post_id
  on conflict (external_id) do update set reason = excluded.reason, removed_by = excluded.removed_by, removed_at = now(), post_id = excluded.post_id;
  if not found then raise exception 'Post not found'; end if;
end $$;
create or replace function public.restore_content_idea(p_external_id text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only superadmins can restore posts'; end if;
  delete from public.content_removals where external_id = p_external_id;
end $$;
revoke execute on function public.remove_content_idea(bigint, text) from public, anon;
grant execute on function public.remove_content_idea(bigint, text) to authenticated;
revoke execute on function public.restore_content_idea(text) from public, anon;
grant execute on function public.restore_content_idea(text) to authenticated;

-- The library hides removed posts for everyone, superadmins included
create or replace function public.library_ideas(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null,
  p_order text default 'latest', p_seed text default '', p_ids bigint[] default null, p_limit int default 24, p_offset int default 0,
  p_boost bigint[] default null, p_boost2 bigint[] default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with m as (
    select c.*,
      case when p_order = 'foryou' then
        case when exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_boost)) then 0
             when exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_boost2)) then 1
             else 2 end end as rank,
      case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as shuffle
    from public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c
    where c.unavailable_at is null and not public.is_removed(c.external_id) and (p_ids is null or c.id = any (p_ids))
  ),
  page as (select * from m order by rank nulls last, shuffle nulls last, published_at desc nulls last, id desc
           limit least(greatest(coalesce(p_limit, 24), 1), 100) offset greatest(coalesce(p_offset, 0), 0))
  select jsonb_build_object('total', (select count(*) from m),
    'data', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio)
      order by p.rank nulls last, p.shuffle nulls last, p.published_at desc nulls last, p.id desc) from page p), '[]'::jsonb));
$$;

create or replace function public.library_filter_counts(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null)
returns table (value_id bigint, ideas bigint) language sql stable security invoker set search_path = public as $$
  select t.value_id, count(*)
  from public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c
  join public.content_idea_tags t on t.idea_id = c.id
  where c.unavailable_at is null and not public.is_removed(c.external_id)
  group by t.value_id;
$$;
