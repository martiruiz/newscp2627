-- My Club highlights (js/my-club.js):
--   club_top_posts  "Best of the week": the club's most viewed posts of the last days (players, sponsors, competitors,
--                   creators and the club's own profiles), for the strip at the top of the page
--   club_space      each person gains avg_views (from club_people_stats, refreshed hourly), shown on the chips
create or replace function public.club_top_posts(p_club bigint, p_days int default 7, p_limit int default 5)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.club_can_view(p_club) then return '[]'::jsonb; end if;
  -- the club's world (its profiles, players, sponsors, creators; not the competitors, they have their own tab); the
  -- recent posts first, then which are the club's (a sponsor's tag can hold tens of thousands of posts)
  return coalesce((
    with ids as materialized (
      select x.idea_id as id from public.club_people_posts(array(select id from public.club_people where club_id = p_club and active and kind <> 'competitor')) x
      union select k::bigint from jsonb_object_keys(public.club_profile_posts(p_club, null, null)) k),
    recent as materialized (
      select c.* from public.content_ideas c
      where c.published_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
        and c.unavailable_at is null and coalesce(c.views, c.likes) is not null)
    select jsonb_agg(x) from (
      select jsonb_build_object('id', r.id, 'cover_url', r.cover_url, 'url', r.url, 'views', r.views, 'likes', r.likes, 'account', r.account,
               'platform', r.account_platform, 'published_at', r.published_at, 'media_type', r.media_type) x
      from recent r join ids using (id)
      where not exists (select 1 from public.content_hidden h where h.external_id = r.external_id)
      order by coalesce(r.views, 0) desc, coalesce(r.likes, 0) desc
      limit least(greatest(coalesce(p_limit, 5), 1), 12)) s), '[]'::jsonb);
end $$;
revoke execute on function public.club_top_posts(bigint, int, int) from public, anon;
grant execute on function public.club_top_posts(bigint, int, int) to authenticated;

-- each person's average views: worked out live it takes ~20 s for a big sponsor (85,000 posts), so it's kept in a table
-- refreshed every hour (pg_cron "scp-club-people-stats") and club_space only reads it
create table if not exists public.club_people_stats (
  person_id bigint primary key references public.club_people (id) on delete cascade,
  avg_views bigint, posts_with_views int, updated_at timestamptz not null default now()
);
alter table public.club_people_stats enable row level security;   -- read only through club_space

create or replace function public.refresh_club_people_stats()
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  delete from public.club_people_stats where true;
  insert into public.club_people_stats (person_id, avg_views, posts_with_views)
    select x.person_id, round(avg(c.views))::bigint, count(*)::int
    from public.club_people_posts(array(select id from public.club_people where active)) x
    join public.content_ideas c on c.id = x.idea_id
    where c.views > 0 and c.unavailable_at is null
    group by x.person_id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.refresh_club_people_stats() from public, anon, authenticated;
select cron.unschedule('scp-club-people-stats') where exists (select 1 from cron.job where jobname = 'scp-club-people-stats');
select cron.schedule('scp-club-people-stats', '40 * * * *', 'select public.refresh_club_people_stats()');

do $$ declare d text := pg_get_functiondef('public.club_space(bigint)'::regprocedure);
begin
  if position('avg_views' in d) = 0 then
    execute replace(d, '''posts'', (select count(*) from public.club_people_posts(array[pp.id])))',
      '''posts'', (select count(*) from public.club_people_posts(array[pp.id])),
        ''avg_views'', (select s.avg_views from public.club_people_stats s where s.person_id = pp.id))');
  end if;
end $$;
select public.refresh_club_people_stats();
