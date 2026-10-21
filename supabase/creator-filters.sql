-- Content Library → Content Creators: filters by the creator's profile (Admin → Scraped profiles, the Excel's
-- CONTENT CREATORS tab + the weekly followers): Creator type · Gender · Creator's language · Country · Followers.
-- They are tags like any other filter: each post gets its account's values (content_ideas.account ↔ scraped_profiles),
-- so counts, panels and saved searches work as usual. refresh_creator_tags() rebuilds them: every Monday (followers
-- move between ranges), and whenever it's called (after an Excel upload, or once the posts' accounts are filled in).
-- Run after creator-profiles.sql. Safe to run again.

alter table public.idea_catalog drop constraint if exists idea_catalog_category_check;
alter table public.idea_catalog add constraint idea_catalog_category_check check (category in (
  'trend', 'sport', 'entity', 'competition', 'club', 'format', 'platform', 'campaign',
  'moment', 'matchday_graphic', 'kit', 'transfer', 'outcome', 'season_moment', 'opponent', 'city',
  'goal', 'comms', 'crisis', 'team', 'angle', 'collab', 'cta',
  'sponsor', 'sponsor_sector', 'sponsor_integration', 'language',
  'aspect_ratio', 'duration',
  'creator_type', 'creator_gender', 'creator_language', 'creator_country', 'creator_followers'));

create or replace function public.refresh_creator_tags()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed'; end if;
  -- each creator's values (followers in ranges)
  create temporary table _cv on commit drop as
    select p.platform, p.handle, x.category, x.name
    from public.scraped_profiles p
    cross join lateral (values
      ('creator_type', initcap(trim(p.creator_type))),
      ('creator_gender', initcap(trim(p.gender))),
      ('creator_language', initcap(trim(p.language))),
      ('creator_country', initcap(trim(p.location))),
      ('creator_followers', case when p.followers is null then null when p.followers < 10000 then 'Under 10K'
        when p.followers < 100000 then '10K–100K' when p.followers < 1000000 then '100K–1M' else 'Over 1M' end)) x(category, name)
    where p.creator and p.active and nullif(x.name, '') is not null;
  insert into public.idea_catalog (category, name) select distinct category, name from _cv on conflict (category, name) do nothing;
  -- the posts' tags, rebuilt
  delete from public.content_idea_tags t using public.idea_catalog v
    where t.value_id = v.id and v.category in ('creator_type', 'creator_gender', 'creator_language', 'creator_country', 'creator_followers');
  insert into public.content_idea_tags (idea_id, value_id)
    select c.id, v.id from _cv cv
    join public.content_ideas c on c.account_platform = cv.platform and c.account = cv.handle
    join public.idea_catalog v on v.category = cv.category and v.name = cv.name
    on conflict do nothing;
  get diagnostics n = row_count;
  perform public.refresh_library_stats('values');
  return jsonb_build_object('creators', (select count(distinct (platform, handle)) from _cv), 'tags', n);
end $$;
revoke execute on function public.refresh_creator_tags() from public, anon;
grant execute on function public.refresh_creator_tags() to authenticated, service_role;

select public.refresh_creator_tags();

-- every Monday at 05:00 (after a week of followers readings)
select cron.unschedule('scp-creator-tags') where exists (select 1 from cron.job where jobname = 'scp-creator-tags');
select cron.schedule('scp-creator-tags', '0 5 * * 1', $c$ select public.refresh_creator_tags(); $c$);
