-- My Club, daily: the clubs' players' and sponsors' posts are imported as usual (Admin → Import, with the account column)
-- and then (1) only show in My Club, not in everyone's Content Library, and (2) get the tags they miss (club, sport of the
-- section, entity Player / Brand). A post is "club only" when its account is linked in My Club, the account isn't in the
-- public scraping list (Admin → Scraped profiles) and the post came in after the account was linked — nothing already
-- public is hidden. Admin → Import runs club_mark_posts() after every import; Admin → My Club after every Excel.
-- Run after my-club.sql. Safe to run again.

alter table public.content_ideas add column if not exists club_only boolean not null default false;
create index if not exists content_ideas_club_only_idx on public.content_ideas (id) where club_only;
alter table public.club_person_accounts add column if not exists created_at timestamptz not null default now();

-- the section names clubs use → the library's sport names
create or replace function public.club_sport_name(p text)
returns text language sql immutable as $$
  select case
    when p ~* 'f[uú]tbol sala|futsal' then 'Futsal'
    when p ~* 'f[uú]tbol|football|soccer' then 'Football'
    when p ~* 'b[aà]squet|basket|baloncesto' then 'Basketball'
    when p ~* 'handbol|handball|balonmano' then 'Handball'
    when p ~* 'hoquei|hockey' then 'Hockey'
    when p ~* 'v[oò]lei|voley|volley' then 'Volleyball'
    when p ~* 'rugbi|rugby' then 'Rugby'
    else p end;
$$;

-- mark the club-only posts and add the missing tags. p_ids: only these posts (an import); null = every post of the clubs' accounts
create or replace function public.club_mark_posts(p_ids bigint[] default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_marked int := 0; v_tagged int := 0;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  create temporary table _cp on commit drop as
    select distinct on (ci.id) ci.id as idea_id, p.club_id, p.kind,
      (select s.name from public.club_links l left join public.club_teams t on t.id = l.team_id
         join public.club_sections s on s.id = coalesce(l.section_id, t.section_id) where l.person_id = p.id order by l.active desc limit 1) as section,
      ci.created_at >= a.created_at and not exists (select 1 from public.scraped_profiles sp where sp.active and sp.platform = a.platform and sp.handle = a.handle) as private
    from public.club_person_accounts a
    join public.club_people p on p.id = a.person_id
    join public.content_ideas ci on ci.account_platform = a.platform and ci.account = a.handle
    where p_ids is null or ci.id = any (p_ids)
    order by ci.id, p.kind;   -- a post of a player and a sponsor at once: player first
  update public.content_ideas c set club_only = true from _cp where c.id = _cp.idea_id and _cp.private and not c.club_only;
  get diagnostics v_marked = row_count;
  -- the tags they miss, only on the club-only posts (public posts are never touched) and one value per category, only when
  -- the post has none in it. Players: club + sport of their section + Player. Sponsors: only Brand (a brand's post isn't
  -- necessarily about the club).
  with want as (
    select _cp.idea_id, ic.id as value_id, ic.category from _cp
    join public.clubs cl on cl.id = _cp.club_id
    join public.idea_catalog ic on (_cp.kind = 'player' and ic.category = 'club' and lower(ic.name) = lower(cl.name))
      or (_cp.kind = 'player' and ic.category = 'sport' and _cp.section is not null and lower(ic.name) = lower(public.club_sport_name(_cp.section)))
      or (ic.category = 'entity' and ic.name = case when _cp.kind = 'player' then 'Player' else 'Brand' end)
    where _cp.private
  )
  insert into public.content_idea_tags (idea_id, value_id)
    select w.idea_id, w.value_id from want w
    where not exists (select 1 from public.content_idea_tags t join public.idea_catalog x on x.id = t.value_id where t.idea_id = w.idea_id and x.category = w.category)
  on conflict do nothing;
  get diagnostics v_tagged = row_count;
  return jsonb_build_object('posts', (select count(*) from _cp), 'club_only', v_marked, 'tags_added', v_tagged);
end $$;
revoke execute on function public.club_mark_posts(bigint[]) from public, anon;
grant execute on function public.club_mark_posts(bigint[]) to authenticated;

-- the import marks its posts by external id
create or replace function public.club_mark_imported(p_external_ids text[])
returns jsonb language sql volatile security definer set search_path = public as $$
  select public.club_mark_posts(coalesce((select array_agg(id) from public.content_ideas where external_id = any (p_external_ids)), '{}'));
$$;
revoke execute on function public.club_mark_imported(text[]) from public, anon;
grant execute on function public.club_mark_imported(text[]) to authenticated;

-- Admin → My Club: every club's accounts for the daily scraping run, with each account's last post
create or replace function public.admin_club_accounts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('club', cl.name, 'person', p.name, 'kind', p.kind, 'platform', a.platform, 'handle', a.handle,
      'section', (select s.name from public.club_links l left join public.club_teams t on t.id = l.team_id join public.club_sections s on s.id = coalesce(l.section_id, t.section_id)
                  where l.person_id = p.id and public.club_link_live(l) limit 1),
      'posts', (select count(*) from public.content_ideas ci where ci.account_platform = a.platform and ci.account = a.handle),
      'last_post', (select max(ci.created_at) from public.content_ideas ci where ci.account_platform = a.platform and ci.account = a.handle))
      order by cl.name, p.kind, p.name)
    from public.club_person_accounts a join public.club_people p on p.id = a.person_id join public.clubs cl on cl.id = p.club_id
    where cl.active and p.active), '[]'::jsonb);
end $$;
revoke execute on function public.admin_club_accounts() from public, anon;
grant execute on function public.admin_club_accounts() to authenticated;

-- ---------- the Content Library without the club-only posts (library_tier as performance-7.sql, library_ideas as performance-8.sql, plus the My Club line) ----------
create or replace function public.library_tier(
  p_filters jsonb, p_q text, p_from date, p_to date, p_ids bigint[], p_by_views boolean, p_min_views bigint, p_max_views bigint,
  p_has bigint[], p_not bigint[], p_by_tags boolean, p_n int)
returns bigint[] language plpgsql stable security invoker set search_path = public as $$
declare v bigint[];
begin
  if p_n <= 0 then return '{}'; end if;
  if p_by_tags then
    select coalesce(array_agg(id), '{}') into v from (
      select c.id from (select distinct t.idea_id from public.content_idea_tags t where t.value_id = any (p_has)) b
      join public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c on c.id = b.idea_id
      where c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
        and (p_ids is not null or not c.club_only)   -- My Club posts: only through My Club (it passes p_ids)
        and (p_ids is null or c.id = any (p_ids))
        and (not p_by_views or c.views is not null) and (p_min_views is null or c.views >= p_min_views) and (p_max_views is null or c.views < p_max_views)
        and (cardinality(p_not) = 0 or not exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_not)))
      order by c.published_at desc nulls last, c.id desc limit p_n) x;
  else
    select coalesce(array_agg(id), '{}') into v from (
      select c.id from public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c
      where c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
        and (p_ids is not null or not c.club_only)   -- My Club posts: only through My Club (it passes p_ids)
        and (p_ids is null or c.id = any (p_ids))
        and (not p_by_views or c.views is not null) and (p_min_views is null or c.views >= p_min_views) and (p_max_views is null or c.views < p_max_views)
        and (p_has is null or exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_has)))
        and (cardinality(p_not) = 0 or not exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_not)))
      order by c.published_at desc nulls last, c.id desc limit p_n) x;
  end if;
  return v;
end $$;


create or replace function public.library_ideas(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null,
  p_order text default 'latest', p_seed text default '', p_ids bigint[] default null, p_limit int default 24, p_offset int default 0,
  p_boost bigint[] default null, p_boost2 bigint[] default null,
  p_min_views bigint default null, p_max_views bigint default null)
returns jsonb language plpgsql volatile security invoker set search_path = public as $$
declare
  lim int := least(greatest(coalesce(p_limit, 24), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := nullif(trim(p_q), '');
  tagged boolean := public.has_tag_filters(p_filters);
  by_views boolean := p_min_views is not null or p_max_views is not null or p_order = 'views';
  only_tags boolean := q is null and p_from is null and p_to is null and p_ids is null and not by_views;
  est bigint;
  small boolean := false;
  k int := 1;
  r int := 0;
  v_total bigint;
  v_data jsonb;
  b0 bigint[]; b1 bigint[]; pf bigint[]; got bigint[] := '{}'; ids bigint[];
begin
  est := case when tagged then coalesce(public.tag_filter_estimate(p_filters), 0)
              else (select n from public.library_totals where key = 'library') end;
  small := tagged and est <= 20000;
  -- "Surprise me" on a big selection: shuffle 1 post in every k (k and the offset r depend on the seed)
  if p_order = 'random' and not small and p_ids is null then
    k := 2;   -- read in shuffle_key order (below)
    r := (hashtext(coalesce(p_seed, ''))::bigint & 2147483647)::int;
  end if;

  -- Total (always the whole selection)
  if only_tags then
    v_total := public.tag_filter_total(p_filters);
  elsif small then
    select count(*) into v_total from public.content_ideas c
    where c.id in (select public.ideas_matching_tags(p_filters))
      and c.unavailable_at is null
      and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (p_ids is not null or not c.club_only)
      and (q is null or c.title ilike '%' || q || '%')
      and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
      and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
      and (p_ids is null or c.id = any (p_ids))
      and (not by_views or c.views is not null)
      and (p_min_views is null or c.views >= p_min_views)
      and (p_max_views is null or c.views < p_max_views);
  else
    select count(*) into v_total from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
    where c.unavailable_at is null
      and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (p_ids is not null or not c.club_only)
      and (p_ids is null or c.id = any (p_ids))
      and (not by_views or c.views is not null)
      and (p_min_views is null or c.views >= p_min_views)
      and (p_max_views is null or c.views < p_max_views);
  end if;

  -- Page
  if small then
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio, c.cover_url, c.media_type, c.duration_s, c.views,
        case when p_order = 'foryou' then
          case when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost, '{}'))) then 0
               when c.id in (select t.idea_id from public.content_idea_tags t where t.value_id = any (coalesce(p_boost2, '{}'))) then 1
               else 2 end end as k_rank,
        case when p_order = 'views' then c.views end as k_views,
        case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as k_shuffle
      from public.content_ideas c
      where c.id in (select public.ideas_matching_tags(p_filters))
        and c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (p_ids is not null or not c.club_only)
        and (q is null or c.title ilike '%' || q || '%')
        and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
        and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
        and (p_ids is null or c.id = any (p_ids))
        and (not by_views or c.views is not null)
        and (p_min_views is null or c.views >= p_min_views)
        and (p_max_views is null or c.views < p_max_views)
      order by k_rank nulls last, k_views desc nulls last, k_shuffle nulls last, c.published_at desc nulls last, c.id desc
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'cover_url', p.cover_url, 'media_type', p.media_type, 'duration_s', p.duration_s, 'views', p.views) order by p.k_rank nulls last, p.k_views desc nulls last, p.k_shuffle nulls last, p.published_at desc nulls last, p.id desc), '[]'::jsonb)
    into v_data from page p;
  elsif k > 1 then
    -- big selection, "Surprise me": posts in shuffle_key order (a fixed random number per post, indexed), starting at a
    -- point that depends on the seed and wrapping round at the end — reads only the posts this page needs
    with
    a1 as (select c.*, 0 as k_lap from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
           where c.shuffle_key >= r and c.unavailable_at is null
             and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (p_ids is not null or not c.club_only)
             and (not by_views or c.views is not null) and (p_min_views is null or c.views >= p_min_views) and (p_max_views is null or c.views < p_max_views)
           order by c.shuffle_key limit lim + off),
    a2 as (select c.*, 1 as k_lap from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
           where c.shuffle_key < r and c.unavailable_at is null
             and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (p_ids is not null or not c.club_only)
             and (not by_views or c.views is not null) and (p_min_views is null or c.views >= p_min_views) and (p_max_views is null or c.views < p_max_views)
           order by c.shuffle_key limit lim + off),
    page as (select * from (select * from a1 union all select * from a2) u order by k_lap, shuffle_key limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'cover_url', p.cover_url, 'media_type', p.media_type, 'duration_s', p.duration_s, 'views', p.views) order by p.k_lap, p.shuffle_key), '[]'::jsonb)
    into v_data from page p;
  elsif p_order = 'foryou' then
    -- big selection, "For you": favourites → their sports / competitions → the rest, newest first in each tier.
    -- Each tier only runs if the ones before didn't fill the page.
    b0 := coalesce(p_boost, '{}'); b1 := coalesce(p_boost2, '{}');
    if jsonb_typeof(p_filters -> 'platform' -> 'ids') = 'array' and jsonb_array_length(p_filters -> 'platform' -> 'ids') > 0 then
      pf := array(select jsonb_array_elements_text(p_filters -> 'platform' -> 'ids'))::bigint[];
      b0 := array(select x from unnest(b0) x where x = any (pf)
                  or not exists (select 1 from public.idea_catalog ic where ic.id = x and ic.category = 'platform'));
    end if;
    b1 := array(select x from unnest(b1) x where x <> all (b0));
    if cardinality(b0) > 0 then
      got := public.library_tier(p_filters, q, p_from, p_to, p_ids, by_views, p_min_views, p_max_views, b0, '{}',
        coalesce((select sum(n.ideas) from public.library_value_counts n where n.value_id = any (b0)), 0) <= 60000, lim + off);
    end if;
    if cardinality(b1) > 0 and cardinality(got) < lim + off then
      got := got || public.library_tier(p_filters, q, p_from, p_to, p_ids, by_views, p_min_views, p_max_views, b1, b0,
        coalesce((select sum(n.ideas) from public.library_value_counts n where n.value_id = any (b1)), 0) <= 60000, lim + off - cardinality(got));
    end if;
    if cardinality(got) < lim + off then
      got := got || public.library_tier(p_filters, q, p_from, p_to, p_ids, by_views, p_min_views, p_max_views, null, b0 || b1, false, lim + off - cardinality(got));
    end if;
    ids := got[off + 1 : off + lim];
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'external_id', c.external_id, 'title', c.title,
        'published_at', c.published_at, 'embed', c.embed, 'url', c.url, 'tags', public.content_idea_tag_map(c.id),
        'media_ratio', c.media_ratio, 'cover_url', c.cover_url, 'media_type', c.media_type, 'duration_s', c.duration_s, 'views', c.views) order by u.n), '[]'::jsonb)
    into v_data from unnest(ids) with ordinality u(id, n) join public.content_ideas c on c.id = u.id;
  else
    with page as (
      select c.id, c.external_id, c.title, c.published_at, c.embed, c.url, c.media_ratio, c.cover_url, c.media_type, c.duration_s, c.views,
        case when p_order = 'views' then c.views end as k_views,
        case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as k_shuffle
      from public.filter_content_ideas(p_filters, q, null, p_from, p_to) c
      where c.unavailable_at is null
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id) and (p_ids is not null or not c.club_only)
        and (p_ids is null or c.id = any (p_ids))
        and (not by_views or c.views is not null)
        and (p_min_views is null or c.views >= p_min_views)
        and (p_max_views is null or c.views < p_max_views)
      order by k_views desc nulls last, k_shuffle nulls last, c.published_at desc nulls last, c.id desc
      limit lim offset off)
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio, 'cover_url', p.cover_url, 'media_type', p.media_type, 'duration_s', p.duration_s, 'views', p.views) order by p.k_views desc nulls last, p.k_shuffle nulls last, p.published_at desc nulls last, p.id desc), '[]'::jsonb)
    into v_data from page p;
  end if;

  return jsonb_build_object('total', v_total, 'data', v_data);
end $$;

grant execute on function public.library_tier(jsonb, text, date, date, bigint[], boolean, bigint, bigint, bigint[], bigint[], boolean, int) to authenticated;

-- ---------- Sponsors from the library: brand accounts already scraped and the library's sponsor tags ----------
-- a sponsor can be tied to the library's sponsor tag (idea_catalog, category sponsor): the club's posts with that tag are
-- "linked to the club" for sure (tagged), besides the brand's own posts that mention the club's accounts
alter table public.club_people add column if not exists catalog_value_id bigint references public.idea_catalog (id) on delete set null;

-- search the library for a brand: its accounts (with posts) and its sponsor tag
create or replace function public.admin_brand_search(p_q text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(lower(trim(regexp_replace(coalesce(p_q, ''), '^@', ''))), '');
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if q is null or length(q) < 2 then return jsonb_build_object('accounts', '[]'::jsonb, 'sponsors', '[]'::jsonb); end if;
  return jsonb_build_object(
    'accounts', coalesce((select jsonb_agg(x order by (x ->> 'posts')::int desc) from (
        select jsonb_build_object('platform', a.platform, 'handle', a.handle, 'name', max(a.name), 'posts', max(a.posts)) as x from (
          select ci.account_platform as platform, ci.account as handle, null::text as name, count(*) as posts
            from public.content_ideas ci where ci.account is not null and ci.account like '%' || q || '%' group by 1, 2
          union all
          select sp.platform, sp.handle, sp.name, 0 from public.scraped_profiles sp where sp.active and (sp.handle like '%' || q || '%' or lower(sp.name) like '%' || q || '%')
        ) a group by a.platform, a.handle order by max(a.posts) desc limit 20) t), '[]'::jsonb),
    'sponsors', coalesce((select jsonb_agg(jsonb_build_object('id', ic.id, 'name', ic.name, 'logo_url', ic.logo_url, 'posts', coalesce(n.ideas, 0)) order by coalesce(n.ideas, 0) desc)
        from public.idea_catalog ic left join public.library_value_counts n on n.value_id = ic.id
        where ic.category = 'sponsor' and lower(ic.name) like '%' || q || '%'), '[]'::jsonb));
end $$;
revoke execute on function public.admin_brand_search(text) from public, anon;
grant execute on function public.admin_brand_search(text) to authenticated;

-- add (or update) a sponsor from the library: name, logo, accounts, sponsor tag and where it belongs (club / section / team)
create or replace function public.admin_club_add_sponsor(p_club bigint, p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_person bigint; a jsonb; v_section bigint := nullif(p ->> 'section_id', '')::bigint; v_team bigint := nullif(p ->> 'team_id', '')::bigint;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if nullif(trim(p ->> 'name'), '') is null then return jsonb_build_object('ok', false, 'error', 'The sponsor needs a name.'); end if;
  insert into public.club_people (club_id, kind, name, photo_url, catalog_value_id)
    values (p_club, 'sponsor', trim(p ->> 'name'), nullif(trim(p ->> 'photo_url'), ''), nullif(p ->> 'catalog_value_id', '')::bigint)
    on conflict (club_id, kind, lower(name)) do update set photo_url = coalesce(excluded.photo_url, club_people.photo_url),
      catalog_value_id = coalesce(excluded.catalog_value_id, club_people.catalog_value_id), active = true
    returning id into v_person;
  for a in select * from jsonb_array_elements(coalesce(p -> 'accounts', '[]'::jsonb)) loop
    if public.clean_handle(a ->> 'handle') is not null then
      insert into public.club_person_accounts (person_id, platform, handle) values (v_person, lower(a ->> 'platform'), public.clean_handle(a ->> 'handle')) on conflict do nothing;
    end if;
  end loop;
  if v_team is not null then v_section := null; end if;
  insert into public.club_links (person_id, section_id, team_id, starts_on, active)
    values (v_person, v_section, v_team, nullif(p ->> 'starts_on', '')::date, true)
    on conflict (person_id, coalesce(section_id, 0), coalesce(team_id, 0)) do update set active = true, ends_on = null;
  return jsonb_build_object('ok', true, 'id', v_person);
end $$;
revoke execute on function public.admin_club_add_sponsor(bigint, jsonb) from public, anon;
grant execute on function public.admin_club_add_sponsor(bigint, jsonb) to authenticated;

-- the selection's posts (as my-club.sql), now with the sponsor tag: "linked to the club" = the brand's posts that mention
-- the club's accounts + the club's own posts (club tag or club accounts) tagged with that sponsor
drop function if exists public.club_post_ids(bigint, text, bigint, bigint, bigint[], boolean);
create or replace function public.club_post_ids(p_club bigint, p_kind text, p_section bigint default null, p_team bigint default null,
  p_people bigint[] default null, p_linked boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_section bigint := p_section; out jsonb; hs text[]; v_people bigint[]; v_clubtag bigint; v_accs jsonb;
begin
  if not public.club_can_view(p_club) then return '{}'::jsonb; end if;
  if p_team is not null then select section_id into v_section from public.club_teams where id = p_team; end if;
  select c.handles, c.accounts, (select ic.id from public.idea_catalog ic where ic.category = 'club' and lower(ic.name) = lower(c.name) limit 1)
    into hs, v_accs, v_clubtag from public.clubs c where c.id = p_club;
  select coalesce(array_agg(distinct p.id), '{}') into v_people
  from public.club_people p join public.club_links l on l.person_id = p.id left join public.club_teams lt on lt.id = l.team_id
  where p.club_id = p_club and p.kind = p_kind and p.active and public.club_link_live(l)
    and (p_people is null or p.id = any (p_people))
    and ((l.section_id is null and l.team_id is null) or (v_section is null and p_team is null)
      or (p_team is not null and (l.team_id = p_team or (l.team_id is null and l.section_id = v_section)))
      or (p_team is null and (l.section_id = v_section or lt.section_id = v_section)));
  if not p_linked then
    select coalesce(jsonb_object_agg(pp.idea_id, pp.person_id), '{}'::jsonb) into out from public.club_people_posts(v_people) pp;
  else
    select coalesce(jsonb_object_agg(x.idea_id, x.person_id), '{}'::jsonb) into out from (
      select pp.idea_id, pp.person_id from public.club_people_posts(v_people) pp join public.content_ideas ci on ci.id = pp.idea_id
        where exists (select 1 from unnest(hs) h where ci.title ilike '%@' || h || '%')
      union
      select t.idea_id, p.id from public.club_people p join public.content_idea_tags t on t.value_id = p.catalog_value_id
        where p.id = any (v_people) and p.catalog_value_id is not null
          and ((v_clubtag is not null and exists (select 1 from public.content_idea_tags ct where ct.idea_id = t.idea_id and ct.value_id = v_clubtag))
            or exists (select 1 from public.content_ideas ci, jsonb_array_elements(v_accs) a where ci.id = t.idea_id and ci.account_platform = a ->> 'platform' and ci.account = a ->> 'handle'))
    ) x;
  end if;
  return out;
end $$;
revoke execute on function public.club_post_ids(bigint, text, bigint, bigint, bigint[], boolean) from public, anon;
grant execute on function public.club_post_ids(bigint, text, bigint, bigint, bigint[], boolean) to authenticated;

-- ---------- The club's own profiles in My Club ("Club" tab) ----------
-- each profile can belong to a section (e.g. @fcbbasket → Basketball); without one it shows in every section
create or replace function public.admin_club_save(p jsonb)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint := nullif(p ->> 'id', '')::bigint; hs text[]; acc jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select coalesce(jsonb_agg(distinct jsonb_strip_nulls(jsonb_build_object('platform', lower(a ->> 'platform'), 'handle', public.clean_handle(a ->> 'handle'),
      'section_id', nullif(a ->> 'section_id', '')::bigint))), '[]'::jsonb) into acc
    from jsonb_array_elements(coalesce(p -> 'accounts', '[]'::jsonb)) a
    where public.clean_handle(a ->> 'handle') is not null and lower(a ->> 'platform') in ('instagram', 'tiktok', 'x', 'youtube', 'facebook', 'linkedin', 'threads');
  select coalesce(array_agg(distinct a ->> 'handle'), '{}') into hs from jsonb_array_elements(acc) a;
  if v_id is null then
    insert into public.clubs (name, logo_url, handles, accounts) values (trim(p ->> 'name'), nullif(trim(p ->> 'logo_url'), ''), hs, acc) returning id into v_id;
  else
    update public.clubs set name = trim(p ->> 'name'), logo_url = nullif(trim(p ->> 'logo_url'), ''), handles = hs, accounts = acc,
      active = coalesce((p ->> 'active')::boolean, active), updated_at = now() where id = v_id;
  end if;
  return v_id;
end $$;

-- the club's profiles with their posts in SCP (for the "Club" tab chips)
create or replace function public.club_profiles(p_club bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.club_can_view(p_club) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('platform', a ->> 'platform', 'handle', a ->> 'handle', 'section_id', (a ->> 'section_id')::bigint,
      'posts', (select count(*) from public.content_ideas ci where ci.account_platform = a ->> 'platform' and ci.account = a ->> 'handle'))
      order by a ->> 'platform', a ->> 'handle')
    from public.clubs c, jsonb_array_elements(c.accounts) a where c.id = p_club), '[]'::jsonb);
end $$;
revoke execute on function public.club_profiles(bigint) from public, anon;
grant execute on function public.club_profiles(bigint) to authenticated;

-- the posts of the club's profiles for a section / team (a team counts as its section): { post id: "platform:handle" }
create or replace function public.club_profile_posts(p_club bigint, p_section bigint default null, p_team bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_section bigint := p_section; out jsonb;
begin
  if not public.club_can_view(p_club) then return '{}'::jsonb; end if;
  if p_team is not null then select section_id into v_section from public.club_teams where id = p_team; end if;
  select coalesce(jsonb_object_agg(ci.id, (a ->> 'platform') || ':' || (a ->> 'handle')), '{}'::jsonb) into out
  from public.clubs c, jsonb_array_elements(c.accounts) a
  join public.content_ideas ci on ci.account_platform = a ->> 'platform' and ci.account = a ->> 'handle'
  where c.id = p_club and (v_section is null or a ->> 'section_id' is null or (a ->> 'section_id')::bigint = v_section);
  return out;
end $$;
revoke execute on function public.club_profile_posts(bigint, bigint, bigint) from public, anon;
grant execute on function public.club_profile_posts(bigint, bigint, bigint) to authenticated;
