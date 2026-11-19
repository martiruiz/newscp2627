-- My Club → "Update views and likes": the club queues all its posts (Instagram, TikTok, YouTube: the networks
-- _shared/engagement.ts reads) and views-cron reads them first, before its usual round (views_due). Slow on purpose
-- (pauses between posts, so no platform blocks it): the page shows how many are done. Club members and admins.
create table if not exists public.views_requests (
  idea_id bigint primary key references public.content_ideas (id) on delete cascade,
  club_id bigint references public.clubs (id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index if not exists views_requests_club_idx on public.views_requests (club_id);
alter table public.views_requests enable row level security;   -- only through the functions below

-- the club's posts on the networks we can read
create or replace function public.club_refreshable_ids(p_club bigint)
returns setof bigint language sql stable security definer set search_path = public as $$
  select ci.id from public.content_ideas ci
  where ci.unavailable_at is null and ci.account_platform in ('instagram', 'tiktok', 'youtube')
    and ci.id in (select x.idea_id from public.club_people_posts(array(select p.id from public.club_people p where p.club_id = p_club and p.active)) x
                  union select k::bigint from jsonb_object_keys(public.club_profile_posts(p_club, null, null)) k);
$$;
revoke execute on function public.club_refreshable_ids(bigint) from public, anon, authenticated;

-- how far it is: queued (still waiting) / done since it was asked
create or replace function public.club_refresh_status(p_club bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.club_can_view(p_club) then jsonb_build_object('ok', false) else
    (select jsonb_build_object('ok', true, 'total', count(*), 'pending', count(*) filter (where c.views_at is null or c.views_at < r.requested_at),
       'requested_at', max(r.requested_at))
     from public.views_requests r join public.content_ideas c on c.id = r.idea_id
     where r.club_id = p_club and c.unavailable_at is null) end;
$$;
revoke execute on function public.club_refresh_status(bigint) from public, anon;
grant execute on function public.club_refresh_status(bigint) to authenticated;

-- queue every post of the club (not the ones read in the last 6 hours); once every 12 hours per club
create or replace function public.club_refresh_views(p_club bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare last timestamptz; n int;
begin
  if not public.club_can_view(p_club) then return jsonb_build_object('ok', false, 'error', 'You don''t have access to this club.'); end if;
  select max(requested_at) into last from public.views_requests where club_id = p_club;
  if last > now() - interval '12 hours' and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'already', 'next', last + interval '12 hours') || public.club_refresh_status(p_club);
  end if;
  delete from public.views_requests where club_id = p_club;
  insert into public.views_requests (idea_id, club_id, requested_at)
    select i, p_club, now() from public.club_refreshable_ids(p_club) i
    join public.content_ideas c on c.id = i where c.views_at is null or c.views_at < now() - interval '6 hours'
    on conflict (idea_id) do update set club_id = excluded.club_id, requested_at = excluded.requested_at;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'queued', n) || public.club_refresh_status(p_club);
end $$;
revoke execute on function public.club_refresh_views(bigint) from public, anon;
grant execute on function public.club_refresh_views(bigint) to authenticated;

-- views-cron's list: the clubs' requests first (oldest request first), then the usual round
create or replace function public.views_due(p_limit integer default 40)
returns table (id bigint, url text) language sql stable security definer set search_path = public as $$
  (select c.id, c.url from public.views_requests r join public.content_ideas c on c.id = r.idea_id
   where c.unavailable_at is null and (c.views_at is null or c.views_at < r.requested_at)
   order by r.requested_at, c.published_at desc limit greatest(p_limit, 1))
  union all
  (select c.id, c.url from public.content_ideas c
   where c.unavailable_at is null and c.published_at > now() - interval '90 days'
     and (c.account_platform in ('tiktok', 'youtube') or (c.account_platform = 'instagram' and (c.media_type in ('reel', 'video') or c.published_at > now() - interval '7 days')))
     and (c.views_at is null
       or (c.published_at > now() - interval '7 days' and c.views_at < now() - interval '20 hours')
       or (c.published_at <= now() - interval '7 days' and c.published_at > now() - interval '30 days' and c.views_at < now() - interval '6 days 12 hours')
       or (c.published_at <= now() - interval '30 days' and c.views_at < now() - interval '29 days'))
     and not exists (select 1 from public.views_requests r where r.idea_id = c.id and (c.views_at is null or c.views_at < r.requested_at))
   order by c.published_at desc limit greatest(p_limit, 1))
  limit greatest(p_limit, 1);
$$;
