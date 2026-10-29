-- Posts a platform no longer shows stay in the Content Library: they're only flagged for review.
-- Until now the automatic checks (covers on import, the daily check-embeds, views-cron, fb-shape, the pipeline scripts) hid
-- them (unavailable_at). They're often wrong: accounts that switch off embedding (LALIGA, Ligue 1…) answer like a deleted
-- post. From now on those checks only flag the post (gone_at): it stays in the library, shows in Admin → Content ideas →
-- "to review" and in the import's issues, and is hidden or deleted only by hand (Keep / bin).
-- LinkedIn posts stay hidden on purpose (supabase/hide-linkedin.sql): untouched.
-- Run once in Supabase (SQL Editor). Safe to run again.
alter table public.content_ideas add column if not exists gone_at timestamptz;   -- a platform said it's not available (to review)

-- whatever process writes unavailable_at, it becomes a flag (no code or Edge Function needs redeploying)
create or replace function public.content_ideas_gone_flag() returns trigger language plpgsql as $$
begin
  if new.unavailable_at is not null and (tg_op = 'INSERT' or old.unavailable_at is null) and coalesce(new.url, '') !~* 'linkedin\.com' then
    new.gone_at := coalesce(new.gone_at, new.unavailable_at);
    new.unavailable_at := null;
  end if;
  return new;
end $$;
drop trigger if exists content_ideas_gone_flag on public.content_ideas;
create trigger content_ideas_gone_flag before insert or update of unavailable_at on public.content_ideas
  for each row execute function public.content_ideas_gone_flag();

-- the posts hidden that way until now: back in the library, flagged for review
update public.content_ideas set gone_at = coalesce(gone_at, unavailable_at), unavailable_at = null
  where unavailable_at is not null and coalesce(url, '') !~* 'linkedin\.com';
create index if not exists content_ideas_gone_idx on public.content_ideas (gone_at desc) where gone_at is not null;
delete from public.library_total_cache where true;   -- cached library totals (performance.sql): counted again

-- the import's covers panel: "the platform doesn't show it" = flagged or hidden
create or replace function public.admin_import_covers(p_import_id bigint, p_todo int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return (select jsonb_build_object(
      'total', count(*),
      'with_cover', count(*) filter (where c.cover_url is not null),
      'no_image', count(*) filter (where c.cover_url is null and c.cover_at is not null and c.unavailable_at is null and c.gone_at is null),
      'removed', count(*) filter (where c.cover_url is null and (c.unavailable_at is not null or c.gone_at is not null)),
      'todo', count(*) filter (where c.cover_url is null and c.cover_at is null and c.unavailable_at is null and c.gone_at is null),
      'todo_ids', coalesce((select jsonb_agg(x.id) from (select id from public.content_ideas
          where import_id = p_import_id and cover_url is null and cover_at is null and unavailable_at is null and gone_at is null order by id limit greatest(p_todo, 0)) x), '[]'::jsonb),
      'sample', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'cover', s.cover_url, 'url', s.url)) from (select id, cover_url, url from public.content_ideas
          where import_id = p_import_id and cover_url is not null order by id desc limit 24) s), '[]'::jsonb),
      'issues_n', count(*) filter (where c.cover_url is null and (c.cover_at is not null or c.unavailable_at is not null or c.gone_at is not null) and c.cover_issue_ok_at is null),
      'issues', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'url', i.url, 'removed', i.unavailable_at is not null or i.gone_at is not null)) from (select id, url, unavailable_at, gone_at from public.content_ideas
          where import_id = p_import_id and cover_url is null and (cover_at is not null or unavailable_at is not null or gone_at is not null) and cover_issue_ok_at is null order by id limit 100) i), '[]'::jsonb),
      'status', (select review_status from public.idea_imports where id = p_import_id))
    from public.content_ideas c where c.import_id = p_import_id);
end $$;

-- "Retry" on an issue: the flag goes too
create or replace function public.admin_import_issue_retry(p_id bigint, p_keep boolean default false)
returns void language plpgsql volatile security definer set search_path = public as $$
declare imp bigint;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.content_ideas set
      unavailable_at = null, gone_at = null,
      cover_at = case when p_keep then coalesce(cover_at, now()) else null end,
      cover_issue_ok_at = case when p_keep then now() else null end
    where id = p_id and cover_url is null
    returning import_id into imp;
  update public.idea_imports i set cover_issues = (select count(*) from public.content_ideas
      where import_id = imp and cover_url is null and cover_issue_ok_at is null)
    where i.id = imp and i.cover_issues is not null;
  delete from public.library_total_cache where true;
end $$;
